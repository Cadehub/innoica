// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Universal Automation Engine E2E Tests
// Verification of Async Correlation, DAG Execution & Anti-Loop Safeguards
// ====================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ActionType,
  TriggerType,
  WorkflowDefinition,
  WorkflowExecution,
  compileNaturalInstruction,
} from '../packages/shared/src/index';
import { AutomationEngine } from '../services/ai-runtime/src/automation/engine.js';
import { ActionRegistry } from '../services/ai-runtime/src/automation/action-registry.js';

describe('Universal Automation Engine & Async Correlation E2E Suite', () => {
  let engine: AutomationEngine;
  let actionRegistry: ActionRegistry;

  beforeEach(() => {
    engine = new AutomationEngine('http://localhost:4001');
    actionRegistry = new ActionRegistry();
  });

  describe('1. Natural Instruction DAG Compilation', () => {
    it('compiles multi-step supplier workflow with linked next_step_id in DAG', () => {
      const prompt =
        'Si un client demande la disponibilité d’un produit, contacte le fournisseur au +237699112233, attends sa réponse puis confirme au client.';
      const res = compileNaturalInstruction(prompt, { locale: 'fr' });

      expect(res.success).toBe(true);
      expect(res.detectedDomain).toBe('suppliers');
      const steps = res.workflow?.steps || [];
      expect(steps.length).toBe(3);

      expect(steps[0].id).toBe('step_inquire_supplier');
      expect(steps[0].next_step_id).toBe('step_wait_supplier_reply');
      expect(steps[1].id).toBe('step_wait_supplier_reply');
      expect(steps[1].next_step_id).toBe('step_reply_customer');
      expect(steps[2].id).toBe('step_reply_customer');
    });

    it('compiles webhook trigger instructions with target URL extraction', () => {
      const prompt =
        'Lorsqu’un message arrive, déclenche le webhook vers https://api.crm-partner.com/inbound-lead et préviens le client.';
      const res = compileNaturalInstruction(prompt, { locale: 'fr' });

      expect(res.success).toBe(true);
      const steps = res.workflow?.steps || [];
      expect(steps.some((s) => s.action_type === 'webhook_call')).toBe(true);
      const webhookStep = steps.find((s) => s.action_type === 'webhook_call');
      expect((webhookStep?.payload as any)?.url).toBe('https://api.crm-partner.com/inbound-lead');
    });

    it('compiles wait_delay instruction with time conversion', () => {
      const prompt =
        'Lorsqu’un client écrit, réponds-lui puis attends 10 minutes avant d’envoyer le message de relance.';
      const res = compileNaturalInstruction(prompt, { locale: 'fr' });

      expect(res.success).toBe(true);
      const steps = res.workflow?.steps || [];
      const delayStep = steps.find((s) => s.action_type === 'wait_delay');
      expect(delayStep).toBeDefined();
      expect((delayStep?.payload as any)?.delay_seconds).toBe(600);
    });
  });

  describe('2. State Machine DAG Execution & Anti-Loop Safeguards', () => {
    it('traverses conditional branches correctly in DAG', async () => {
      const vars = {
        order: { total: 25000 },
        contact: { phone: '+237691234567' },
      };

      const condVip = {
        field: 'order.total',
        operator: 'greater_than' as const,
        value: 20000,
      };

      expect(engine.evaluateCondition(condVip, vars)).toBe(true);

      const condStandard = {
        field: 'order.total',
        operator: 'less_than' as const,
        value: 10000,
      };

      expect(engine.evaluateCondition(condStandard, vars)).toBe(false);
    });

    it('prevents infinite loops in cyclic DAG workflows via MAX_CYCLES limit', async () => {
      // Mock execution with cyclic step loop
      const cyclicWorkflow: WorkflowDefinition = {
        id: 'wf_cyclic',
        workspace_id: 'ws_test',
        agent_id: 'agent_test',
        name: 'Cyclic Loop Test',
        description: null,
        domain: 'general',
        natural_instruction: 'Loop forever',
        trigger_type: 'wa_private_message_received',
        trigger_config: {},
        conditions: [],
        steps: [
          {
            id: 'step_a',
            name: 'Étape A',
            action_type: 'generate_business_report',
            payload: {},
            next_step_id: 'step_b',
          },
          {
            id: 'step_b',
            name: 'Étape B',
            action_type: 'generate_business_report',
            payload: {},
            next_step_id: 'step_a', // cycle back to A
          },
        ],
        status: 'active',
        priority: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockExecution: WorkflowExecution = {
        id: 'exec_cyclic',
        workspace_id: 'ws_test',
        workflow_id: 'wf_cyclic',
        agent_id: 'agent_test',
        status: 'running',
        trigger_event: 'wa_private_message_received',
        trigger_payload: {},
        current_step_index: 0,
        variables: {},
        waiting_context: null,
        error_details: null,
        started_at: new Date().toISOString(),
        completed_at: null,
        created_at: new Date().toISOString(),
      };

      // Mock database update on Supabase
      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'log_mock' }, error: null }),
        }),
      });

      (engine as any).supabase = {
        from: vi.fn((table: string) => {
          if (table === 'workflow_executions') {
            return { update: updateMock };
          }
          if (table === 'workflow_execution_logs') {
            return { insert: insertMock, update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }) };
          }
          return { select: vi.fn() };
        }),
      };

      (engine as any).actionRegistry = {
        executeAction: vi.fn().mockResolvedValue({ success: true, output: {} }),
      };

      await engine.runExecutionSteps(mockExecution, cyclicWorkflow);

      // Verify that execution was aborted with infinite loop error
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_details: expect.objectContaining({
            error: expect.stringContaining('boucle infinie détectée'),
          }),
        })
      );
    });
  });

  describe('3. Asynchronous Supplier-Client Correlation', () => {
    it('correlates incoming external supplier message to the exact waiting execution', async () => {
      const waitingExec = {
        id: 'exec_wait_123',
        status: 'waiting',
        agent_id: 'agent_wa_1',
        expected_sender_phone: '+237699112233',
        correlation_id: 'corr_456',
        waiting_context: {
          waiting_for_action: 'wait_for_message',
          expected_phone: '+237699112233',
          variable_to_store: 'supplier_response',
          step_index: 1,
        },
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [waitingExec],
            error: null,
          }),
        }),
      });

      (engine as any).supabase = {
        from: vi.fn((table: string) => {
          if (table === 'workflow_executions') {
            return { select: selectMock };
          }
          return { select: vi.fn() };
        }),
      };

      const resumeSpy = vi.spyOn(engine, 'resumeWaitingExecution').mockResolvedValue(true);

      // 1. Un message d'un inconnu n'active PAS la corrélation
      const countUnknown = await engine.checkAndResumeWaitingWorkflows(
        'agent_wa_1',
        '+237655000000',
        'Bonjour inconnu'
      );
      expect(countUnknown).toBe(0);
      expect(resumeSpy).not.toHaveBeenCalled();

      // 2. Le message du fournisseur attendu résout la corrélation
      const countSupplier = await engine.checkAndResumeWaitingWorkflows(
        'agent_wa_1',
        '+237699112233',
        'Oui disponible en stock à 15000 FCFA'
      );
      expect(countSupplier).toBe(1);
      expect(resumeSpy).toHaveBeenCalledWith(
        'exec_wait_123',
        expect.objectContaining({
          text: 'Oui disponible en stock à 15000 FCFA',
          sender: '+237699112233',
        })
      );
    });
  });

  describe('4. Webhook SSRF Safety Guards', () => {
    it('blocks internal private IPs in webhook_call step', async () => {
      const context = {
        workspaceId: 'ws_ssrf_test',
        agentId: 'agent_ssrf',
        execution: {
          id: 'exec_ssrf',
          workspace_id: 'ws_ssrf_test',
          workflow_id: 'wf_ssrf',
          agent_id: 'agent_ssrf',
          status: 'running',
          trigger_event: 'wa_private_message_received',
          trigger_payload: {},
          current_step_index: 0,
          variables: {},
          waiting_context: null,
          error_details: null,
          started_at: new Date().toISOString(),
          completed_at: null,
          created_at: new Date().toISOString(),
        } as WorkflowExecution,
        step: {
          id: 'step_hack_internal',
          name: 'Appel serveur local interdit',
          action_type: 'webhook_call' as ActionType,
          payload: {
            url: 'http://127.0.0.1:8080/admin/delete-database',
          },
        },
        variables: {},
        whatsappWorkerUrl: 'http://localhost:4001',
      };

      const result = await actionRegistry.executeAction(context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('SSRF');
    });
  });

  describe('5. Outbound Media Messages via Action Registry', () => {
    it('dispatches outbound image or document messages to WhatsApp Worker', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, messageId: 'WA-OUTBOUND-MEDIA-999' }),
      } as any);

      const context = {
        workspaceId: 'ws_media_test',
        agentId: 'agent_media_1',
        execution: {
          id: 'exec_media_1',
          workspace_id: 'ws_media_test',
          workflow_id: 'wf_media_1',
          agent_id: 'agent_media_1',
          status: 'running',
          trigger_event: 'wa_private_message_received',
          trigger_payload: {},
          current_step_index: 0,
          variables: {
            client: { phone: '+237691234567' },
          },
          waiting_context: null,
          error_details: null,
          started_at: new Date().toISOString(),
          completed_at: null,
          created_at: new Date().toISOString(),
        } as WorkflowExecution,
        step: {
          id: 'step_send_catalog_pdf',
          name: 'Envoyer le catalogue PDF',
          action_type: 'send_private_message' as ActionType,
          payload: {
            recipient_phone: '{{client.phone}}',
            document_url: 'https://cdn.example.com/catalog-2026.pdf',
            file_name: 'Catalogue-INNOICA.pdf',
            caption: 'Voici notre catalogue officiel',
          },
        },
        variables: {
          client: { phone: '+237691234567' },
        },
        whatsappWorkerUrl: 'http://localhost:4001',
      };

      const result = await actionRegistry.executeAction(context);
      expect(result.success).toBe(true);
      expect(result.output?.sent).toBe(true);
      expect(result.output?.messageId).toBe('WA-OUTBOUND-MEDIA-999');

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:4001/api/sessions/agent_media_1/send',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Catalogue-INNOICA.pdf'),
        })
      );

      fetchSpy.mockRestore();
    });
  });
});

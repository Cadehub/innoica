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

  describe('6. Delays, Timeouts & Human Approvals Engine Suite', () => {
    it('sweeps and resumes expired wait_delay workflows automatically', async () => {
      const expiredDelayExec = {
        id: 'exec_delay_expired',
        status: 'waiting',
        current_step_index: 0,
        waiting_context: {
          waiting_for_action: 'wait_delay',
          resume_at: new Date(Date.now() - 5000).toISOString(), // 5s in the past
        },
        workflow: {
          id: 'wf_delay',
          steps: [
            { id: 'step_1', action_type: 'wait_delay', payload: { delay_seconds: 5 }, next_step_id: 'step_2' },
            { id: 'step_2', action_type: 'generate_business_report', payload: {} },
          ],
        },
      };

      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
      (engine as any).supabase = {
        from: vi.fn((table: string) => {
          if (table === 'workflow_executions') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [expiredDelayExec], error: null }),
              }),
              update: updateMock,
            };
          }
          if (table === 'workflow_execution_logs') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'log_mock' }, error: null }),
                }),
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
            };
          }
          return { select: vi.fn() };
        }),
      };

      const runStepsSpy = vi.spyOn(engine, 'runExecutionSteps').mockResolvedValue();

      const result = await engine.processWaitingTimeoutsAndDelays();
      expect(result.resumedDelays).toBe(1);
      expect(runStepsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'exec_delay_expired',
          status: 'running',
          current_step_index: 1,
        }),
        expect.anything()
      );
    });

    it('marks expired wait_for_message executions as failed when supplier never replies', async () => {
      const expiredWaitExec = {
        id: 'exec_timeout_expired',
        status: 'waiting',
        current_step_index: 0,
        waiting_context: {
          waiting_for_action: 'wait_for_message',
          timeout_at: new Date(Date.now() - 10000).toISOString(), // 10s in the past
        },
        workflow: {
          id: 'wf_supplier',
          steps: [
            { id: 'step_1', action_type: 'wait_for_message', payload: {}, on_error: 'fail' },
          ],
        },
      };

      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
      (engine as any).supabase = {
        from: vi.fn((table: string) => {
          if (table === 'workflow_executions') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [expiredWaitExec], error: null }),
              }),
              update: updateMock,
            };
          }
          return { select: vi.fn() };
        }),
      };

      const result = await engine.processWaitingTimeoutsAndDelays();
      expect(result.timedOutWaitings).toBe(1);
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_details: expect.objectContaining({
            error: expect.stringContaining('timeout expiré'),
          }),
        })
      );
    });

    it('resumes workflow execution seamlessly upon human approval', async () => {
      const pendingApprovalExec = {
        id: 'exec_approval_1',
        status: 'needs_approval',
        current_step_index: 0,
        workflow: {
          id: 'wf_admin',
          steps: [
            { id: 'step_admin_action', action_type: 'kick_group_participant', require_approval: true, next_step_id: 'step_done' },
            { id: 'step_done', action_type: 'generate_business_report' },
          ],
        },
      };

      const updateExecMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
      (engine as any).supabase = {
        from: vi.fn((table: string) => {
          if (table === 'workflow_executions') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: pendingApprovalExec, error: null }),
                }),
              }),
              update: updateExecMock,
            };
          }
          if (table === 'workflow_execution_logs') {
            return {
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({}),
                }),
              }),
            };
          }
          return { select: vi.fn() };
        }),
      };

      const runSpy = vi.spyOn(engine, 'runExecutionSteps').mockResolvedValue();

      const ok = await engine.resumeApprovedExecution('exec_approval_1', 'approved', 'user_admin_123');
      expect(ok).toBe(true);
      expect(runSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'exec_approval_1',
          status: 'running',
          current_step_index: 1,
        }),
        expect.anything()
      );
    });

    it('detects active waiting workflow to mute conversational AI', async () => {
      const waitingExec = {
        id: 'exec_wait_customer',
        agent_id: 'agent_active_1',
        expected_sender_phone: '+237699112233',
        variables: {
          contact: { phone: '+237654321000' },
          conversationId: 'conv_123_abc',
        },
      };

      (engine as any).supabase = {
        from: vi.fn((table: string) => {
          if (table === 'workflow_executions') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: [waitingExec], error: null }),
                }),
              }),
            };
          }
          return { select: vi.fn() };
        }),
      };

      // Matched by customer contact phone
      const isWaitingByPhone = await engine.hasActiveWaitingWorkflow('agent_active_1', '+237654321000');
      expect(isWaitingByPhone).toBe(true);

      // Matched by conversationId
      const isWaitingByConv = await engine.hasActiveWaitingWorkflow('agent_active_1', undefined, 'conv_123_abc');
      expect(isWaitingByConv).toBe(true);

      // Unmatched phone returns false
      const isWaitingOther = await engine.hasActiveWaitingWorkflow('agent_active_1', '+237677999888');
      expect(isWaitingOther).toBe(false);
    });

    it('mutates execution.status in memory when transitioning to waiting state', async () => {
      const waitingWorkflow: WorkflowDefinition = {
        id: 'wf_wait_state',
        workspace_id: 'ws_test',
        agent_id: 'agent_test',
        name: 'Wait State Test',
        description: null,
        domain: 'suppliers',
        natural_instruction: 'Wait for supplier',
        trigger_type: 'wa_private_message_received',
        trigger_config: {},
        conditions: [],
        steps: [
          {
            id: 'step_wait',
            name: 'Attendre fournisseur',
            action_type: 'wait_for_message',
            payload: { timeout_minutes: 30, expected_phone: '+237699000000' },
          },
        ],
        status: 'active',
        priority: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const execution: WorkflowExecution = {
        id: 'exec_in_memory_test',
        workspace_id: 'ws_test',
        workflow_id: 'wf_wait_state',
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

      (engine as any).supabase = {
        from: vi.fn(() => ({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'log_mock' }, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
        })),
      };

      await engine.runExecutionSteps(execution, waitingWorkflow);

      // CRITICAL CHECK: In-memory execution object must reflect status 'waiting'
      expect(execution.status).toBe('waiting');
      expect(execution.expected_sender_phone).toBe('+237699000000');
    });
  });
});

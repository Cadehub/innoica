// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Natural Language Instruction Compiler
// Transforms conversational business rules into structured Zod workflows
// ====================================================================

import {
  ActionType,
  AutomationDomain,
  NaturalInstructionCompileResult,
  TriggerType,
  WorkflowCondition,
  WorkflowStep,
} from '../types/automation';

interface CompileOptions {
  agentId?: string | null;
  preferredDomain?: AutomationDomain;
  locale?: 'fr' | 'en';
}

/**
 * Compiles a free-form natural language business instruction into a structured
 * deterministic WorkflowDefinition draft with simulations, permissions, and missing data detection.
 */
export function compileNaturalInstruction(
  rawInstruction: string,
  options?: CompileOptions
): NaturalInstructionCompileResult {
  const instruction = rawInstruction.trim();
  const lower = instruction.toLowerCase();
  const locale = options?.locale || 'fr';

  if (instruction.length < 5) {
    return {
      success: false,
      detectedDomain: 'general',
      humanExplanation: locale === 'en' ? 'Instruction is too short' : 'L’instruction est trop courte',
      confidenceScore: 0,
      missingInformation: [locale === 'en' ? 'Detailed instruction text' : 'Texte détaillé de l’instruction'],
      requiredPermissions: [],
      error: 'INSTRUCTION_TOO_SHORT',
    };
  }

  let domain: AutomationDomain = options?.preferredDomain || 'general';
  let triggerType: TriggerType = 'wa_private_message_received';
  const triggerConfig: Record<string, unknown> = {};
  const conditions: WorkflowCondition[] = [];
  const steps: WorkflowStep[] = [];
  const missingInformation: string[] = [];
  const requiredPermissions: string[] = [];
  const dryRunSteps: Array<{ stepName: string; action: string; outputPreview: string }> = [];

  // --- 1. Détection du Domaine Métier ---
  if (lower.includes('fournisseur') || lower.includes('disponibilité') || lower.includes('supplier')) {
    domain = 'suppliers';
  } else if (lower.includes('absence') || lower.includes('congé') || lower.includes('employé') || lower.includes('rh')) {
    domain = 'hr';
  } else if (lower.includes('mécontent') || lower.includes('réclamation') || lower.includes('plainte') || lower.includes('complaint')) {
    domain = 'support';
  } else if (lower.includes('matin') || lower.includes('rapport') || lower.includes('chaque jour') || lower.includes('quotidien') || lower.includes('report')) {
    domain = 'internal';
  } else if (lower.includes('groupe') || lower.includes('group')) {
    domain = 'group_mgmt';
  } else if (lower.includes('chaîne') || lower.includes('chaine') || lower.includes('channel') || lower.includes('newsletter')) {
    domain = 'channel_mgmt';
  } else if (lower.includes('commande') || lower.includes('panier') || lower.includes('produit') || lower.includes('achat') || lower.includes('order')) {
    domain = 'commerce';
  }

  // --- 2. Détection du Déclencheur ---
  if (lower.includes('chaque matin') || lower.includes('tous les matins')) {
    triggerType = 'schedule_cron';
    triggerConfig.cron = '0 8 * * *';
    triggerConfig.timezone = 'Africa/Douala';
    triggerConfig.description = 'Tous les matins à 08h00';
  } else if (lower.includes('chaque soir') || lower.includes('tous les soirs')) {
    triggerType = 'schedule_cron';
    triggerConfig.cron = '0 18 * * *';
    triggerConfig.timezone = 'Africa/Douala';
    triggerConfig.description = 'Tous les soirs à 18h00';
  } else if (lower.includes('dans le groupe') || lower.includes('groupe')) {
    if (lower.includes('mention') || lower.includes('@')) {
      triggerType = 'wa_group_bot_mentioned';
    } else {
      triggerType = 'wa_group_message_received';
    }
  } else if (lower.includes('vocal') || lower.includes('audio') || lower.includes('voix')) {
    triggerType = 'wa_private_voice_received';
  } else if (lower.includes('photo') || lower.includes('image')) {
    triggerType = 'wa_private_image_received';
  } else {
    triggerType = 'wa_private_message_received';
  }

  // --- 3. Détection des Conditions ---
  if (lower.includes('mécontent') || lower.includes('insatisfait') || lower.includes('colère')) {
    conditions.push({
      field: 'message.sentiment',
      operator: 'equals',
      value: 'negative',
    });
  }
  if (lower.includes('produit') || lower.includes('disponibilité')) {
    conditions.push({
      field: 'message.intent',
      operator: 'contains',
      value: 'product_availability',
    });
  }
  if (lower.includes('absence') || lower.includes('maladie') || lower.includes('absent')) {
    conditions.push({
      field: 'message.intent',
      operator: 'contains',
      value: 'absence_report',
    });
  }

  // --- 4. Détection et Construction des Étapes d'Action ---

  // Scénario A : Fournisseur & Attente de réponse (wait_for_message)
  if (domain === 'suppliers' || lower.includes('contacte le fournisseur') || lower.includes('attends sa réponse')) {
    requiredPermissions.push('permission.send_supplier_messages');

    // Étape 1 : Demande au fournisseur
    steps.push({
      id: 'step_inquire_supplier',
      name: 'Contacter le fournisseur autorisé',
      action_type: 'send_supplier_inquiry',
      payload: {
        template: 'Bonjour, demande de disponibilité immédiate pour la référence client : {{message.text}}',
        recipient_role: 'supplier',
      },
    });
    dryRunSteps.push({
      stepName: 'Contacter le fournisseur autorisé',
      action: 'send_supplier_inquiry',
      outputPreview: 'Message WhatsApp généré et envoyé au numéro du fournisseur.',
    });

    // Étape 2 : Attente de la réponse du fournisseur (wait_for_message)
    steps.push({
      id: 'step_wait_supplier_reply',
      name: 'Attendre la confirmation du fournisseur',
      action_type: 'wait_for_message',
      payload: {
        timeout_minutes: 60,
        expected_role: 'supplier',
        variable_to_store: 'supplier_response',
      },
      timeout_minutes: 60,
    });
    dryRunSteps.push({
      stepName: 'Attendre la confirmation du fournisseur',
      action: 'wait_for_message',
      outputPreview: 'Workflow mis en pause sécurisée. En attente de la réponse du fournisseur (délai: 60 min).',
    });

    // Étape 3 : Réponse au client final
    steps.push({
      id: 'step_reply_customer',
      name: 'Répondre au client initial avec l’information',
      action_type: 'send_private_message',
      payload: {
        text: 'Bonjour, suite à confirmation auprès de notre fournisseur : {{supplier_response.text}}',
        recipient_phone: '{{client.phone}}',
      },
    });
    dryRunSteps.push({
      stepName: 'Répondre au client initial avec l’information',
      action: 'send_private_message',
      outputPreview: 'Notification automatique envoyée au client dès réception du fournisseur.',
    });

    missingInformation.push('Numéro WhatsApp officiel du fournisseur (ou fiche fournisseur associée)');
  }
  // Scénario B : Gestion des Absences RH
  else if (domain === 'hr' || lower.includes('absence') || lower.includes('congé')) {
    requiredPermissions.push('permission.manage_hr_records');

    steps.push({
      id: 'step_record_absence',
      name: 'Enregistrer la déclaration d’absence',
      action_type: 'record_employee_absence',
      payload: {
        employee_identifier: '{{contact.phone}}',
        reason: '{{message.text}}',
        status: 'pending_review',
      },
    });
    dryRunSteps.push({
      stepName: 'Enregistrer la déclaration d’absence',
      action: 'record_employee_absence',
      outputPreview: 'Fiche d’absence créée dans le registre RH interne.',
    });

    steps.push({
      id: 'step_notify_manager_hr',
      name: 'Notifier le responsable RH',
      action_type: 'notify_manager',
      payload: {
        title: 'Nouvelle absence signalée',
        summary: 'L’employé {{contact.name}} ({{contact.phone}}) signale : {{message.text}}',
      },
    });
    dryRunSteps.push({
      stepName: 'Notifier le responsable RH',
      action: 'notify_manager',
      outputPreview: 'Alerte WhatsApp transmise immédiatement au responsable.',
    });
  }
  // Scénario C : Réclamation & Escalade Manager
  else if (domain === 'support' || lower.includes('mécontent') || lower.includes('avertis le responsable')) {
    steps.push({
      id: 'step_notify_manager_support',
      name: 'Alerter le responsable du mécontentement',
      action_type: 'notify_manager',
      payload: {
        title: 'Alerte insatisfaction client',
        summary: 'Client {{contact.phone}} insatisfait : "{{message.text}}". Reprise conseillée.',
      },
    });
    dryRunSteps.push({
      stepName: 'Alerter le responsable du mécontentement',
      action: 'notify_manager',
      outputPreview: 'Message d’alerte d’escalade envoyé au manager.',
    });

    steps.push({
      id: 'step_request_reprise',
      name: 'Proposer le transfert humain',
      action_type: 'transfer_to_human',
      payload: {
        reason: 'Client insatisfait détecté par consigne d’agent',
      },
    });
    dryRunSteps.push({
      stepName: 'Proposer le transfert humain',
      action: 'transfer_to_human',
      outputPreview: 'La conversation est basculée en attente de prise en main humaine.',
    });
  }
  // Scénario D : Rapport Quotidien Matinal
  else if (triggerType === 'schedule_cron' || lower.includes('rapport')) {
    steps.push({
      id: 'step_generate_report',
      name: 'Compiler le rapport d’activité',
      action_type: 'generate_business_report',
      payload: {
        period: 'last_24_hours',
        include_conversations: true,
        include_orders: true,
      },
    });
    dryRunSteps.push({
      stepName: 'Compiler le rapport d’activité',
      action: 'generate_business_report',
      outputPreview: 'Synthèse chiffrée générée : volume des messages, leads, commandes.',
    });

    steps.push({
      id: 'step_send_report_owner',
      name: 'Transmettre le rapport au propriétaire',
      action_type: 'notify_manager',
      payload: {
        title: 'Rapport Quotidien d’Activité INNOICA',
        summary: '{{report.summary}}',
      },
    });
    dryRunSteps.push({
      stepName: 'Transmettre le rapport au propriétaire',
      action: 'notify_manager',
      outputPreview: 'Rapport envoyé par WhatsApp sur le numéro du propriétaire de l’entreprise.',
    });
  }
  // Scénario E : Groupes WhatsApp
  else if (domain === 'group_mgmt' || lower.includes('groupe')) {
    steps.push({
      id: 'step_reply_group',
      name: 'Répondre dans le groupe autorisé',
      action_type: 'send_group_message',
      payload: {
        group_jid: '{{group.jid}}',
        text: '{{llm_reply}}',
      },
    });
    dryRunSteps.push({
      stepName: 'Répondre dans le groupe autorisé',
      action: 'send_group_message',
      outputPreview: 'Réponse formulée et postée directement dans le groupe ciblé.',
    });
  }
  // Fallback générique par défaut
  else {
    steps.push({
      id: 'step_generic_reply',
      name: 'Formuler la réponse selon les consignes',
      action_type: 'send_private_message',
      payload: {
        text: '{{llm_reply}}',
      },
    });
    dryRunSteps.push({
      stepName: 'Formuler la réponse selon les consignes',
      action: 'send_private_message',
      outputPreview: 'Réponse contextuelle envoyée selon les règles métier définies.',
    });
  }

  // Nom déduit du workflow
  const cleanName =
    instruction.length > 50 ? `${instruction.slice(0, 47)}...` : instruction;

  // Explication humaine rédigée
  let humanExplanation = '';
  if (locale === 'en') {
    humanExplanation = `When ${triggerType.replace(/_/g, ' ')}, the agent will verify ${
      conditions.length
    } condition(s), then execute: ${steps.map((s) => s.name).join(' ➔ ')}.`;
  } else {
    humanExplanation = `Dès que l’événement "${triggerType}" survient, l’agent applique ${
      conditions.length
    } condition(s) de filtrage, puis enchaîne les actions : ${steps.map((s) => s.name).join(' ➔ ')}.`;
  }

  return {
    success: true,
    detectedDomain: domain,
    humanExplanation,
    confidenceScore: 0.95,
    missingInformation,
    requiredPermissions,
    simulatedDryRun: {
      triggerSimulated: triggerType,
      stepsSimulated: dryRunSteps,
    },
    workflow: {
      name: cleanName,
      domain,
      natural_instruction: instruction,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      conditions,
      steps,
      status: 'active',
      priority: 10,
    },
  };
}

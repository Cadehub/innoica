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
 * Extracts explicit international or local phone numbers mentioned in a natural instruction.
 * Examples: +237692265718, 692265718, contacte le 695923604, au numéro +33612345678
 */
export function extractTargetPhoneNumber(text: string): string | null {
  // 1. Explicit international phone number format (+237..., +33...)
  const intlMatch = text.match(/(\+[1-9]\d{7,14})/);
  if (intlMatch) {
    return intlMatch[1];
  }
  // 2. Preceded by keywords (numéro, contacte, au, fournisseur, etc.)
  const kwMatch = text.match(
    /(?:numéro|numero|contacte|contacter|avertis|avertir|préviens|previens|appelle|appeler|fournisseur|responsable|au)\s*[:]?\s*(?:est\s+le\s+)?(?:\+)?([0-9\s.-]{8,15})/i
  );
  if (kwMatch && kwMatch[1]) {
    const cleaned = kwMatch[1].replace(/[\s.-]/g, '');
    if (cleaned.length >= 8) {
      return cleaned.startsWith('237') ? `+${cleaned}` : `+237${cleaned}`;
    }
  }
  // 3. Standalone Cameroonian 9-digit format (6xxxxxxxx, 2xxxxxxxx)
  const cmMatch = text.match(/(?<!\d)(?:6[5789]\d{7}|2[234]\d{7})(?!\d)/);
  if (cmMatch) {
    return `+237${cmMatch[0]}`;
  }
  return null;
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

  const targetPhone = extractTargetPhoneNumber(instruction);

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
      name: targetPhone ? `Contacter le fournisseur (${targetPhone})` : 'Contacter le fournisseur autorisé',
      action_type: 'send_supplier_inquiry',
      payload: {
        template: 'Bonjour, demande de disponibilité immédiate pour la référence client : {{message.text}}',
        recipient_role: 'supplier',
        supplier_phone: targetPhone || undefined,
        recipient_phone: targetPhone || undefined,
      },
      next_step_id: 'step_wait_supplier_reply',
    });
    dryRunSteps.push({
      stepName: targetPhone ? `Contacter le fournisseur (${targetPhone})` : 'Contacter le fournisseur autorisé',
      action: 'send_supplier_inquiry',
      outputPreview: targetPhone
        ? `Message WhatsApp généré et envoyé immédiatement au numéro ${targetPhone}.`
        : 'Message WhatsApp généré et envoyé au numéro du fournisseur.',
    });

    // Étape 2 : Attente de la réponse du fournisseur (wait_for_message)
    steps.push({
      id: 'step_wait_supplier_reply',
      name: 'Attendre la confirmation du fournisseur',
      action_type: 'wait_for_message',
      payload: {
        timeout_minutes: 60,
        expected_role: 'supplier',
        expected_phone: targetPhone || undefined,
        variable_to_store: 'supplier_response',
      },
      timeout_minutes: 60,
      next_step_id: 'step_reply_customer',
    });
    dryRunSteps.push({
      stepName: 'Attendre la confirmation du fournisseur',
      action: 'wait_for_message',
      outputPreview: targetPhone
        ? `Workflow en attente de la réponse du fournisseur (${targetPhone}).`
        : 'Workflow mis en pause sécurisée. En attente de la réponse du fournisseur (délai: 60 min).',
    });

    // Étape 3 : Réponse au client final
    steps.push({
      id: 'step_reply_customer',
      name: 'Répondre au client initial avec l’information',
      action_type: 'send_private_message',
      payload: {
        text: 'Bonjour, suite à confirmation auprès de notre fournisseur : {{supplier_response.text}}',
        recipient_phone: '{{contact.phone}}',
      },
    });
    dryRunSteps.push({
      stepName: 'Répondre au client initial avec l’information',
      action: 'send_private_message',
      outputPreview: 'Notification automatique envoyée au client dès réception du fournisseur.',
    });

    if (!targetPhone) {
      missingInformation.push('Numéro WhatsApp officiel du fournisseur (ou fiche fournisseur associée)');
    }
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
      next_step_id: 'step_notify_manager_hr',
    });
    dryRunSteps.push({
      stepName: 'Enregistrer la déclaration d’absence',
      action: 'record_employee_absence',
      outputPreview: 'Fiche d’absence créée dans le registre RH interne.',
    });

    steps.push({
      id: 'step_notify_manager_hr',
      name: targetPhone ? `Notifier le responsable RH (${targetPhone})` : 'Notifier le responsable RH',
      action_type: 'notify_manager',
      payload: {
        title: 'Nouvelle absence signalée',
        summary: 'L’employé {{contact.name}} ({{contact.phone}}) signale : {{message.text}}',
        phone: targetPhone || undefined,
        recipient_phone: targetPhone || undefined,
      },
    });
    dryRunSteps.push({
      stepName: targetPhone ? `Notifier le responsable RH (${targetPhone})` : 'Notifier le responsable RH',
      action: 'notify_manager',
      outputPreview: targetPhone
        ? `Alerte WhatsApp transmise immédiatement au responsable sur ${targetPhone}.`
        : 'Alerte WhatsApp transmise immédiatement au responsable.',
    });
  }
  // Scénario C : Réclamation & Escalade Manager
  else if (domain === 'support' || lower.includes('mécontent') || lower.includes('avertis le responsable')) {
    steps.push({
      id: 'step_notify_manager_support',
      name: targetPhone ? `Alerter le responsable (${targetPhone})` : 'Alerter le responsable du mécontentement',
      action_type: 'notify_manager',
      payload: {
        title: 'Alerte insatisfaction client',
        summary: 'Client {{contact.phone}} insatisfait : "{{message.text}}". Reprise conseillée.',
        phone: targetPhone || undefined,
        recipient_phone: targetPhone || undefined,
      },
      next_step_id: 'step_request_reprise',
    });
    dryRunSteps.push({
      stepName: targetPhone ? `Alerter le responsable (${targetPhone})` : 'Alerter le responsable du mécontentement',
      action: 'notify_manager',
      outputPreview: targetPhone
        ? `Message d’alerte envoyé au responsable (${targetPhone}).`
        : 'Message d’alerte d’escalade envoyé au manager.',
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
  // Scénario D : Webhook ou Appel API externe
  else if (lower.includes('webhook') || lower.includes('api') || lower.includes('http://') || lower.includes('https://')) {
    const urlMatch = instruction.match(/https?:\/\/[^\s"'<>]+/i);
    const targetUrl = urlMatch ? urlMatch[0] : '';

    steps.push({
      id: 'step_call_webhook',
      name: targetUrl ? `Déclencher le webhook (${new URL(targetUrl).hostname})` : 'Déclencher le webhook externe',
      action_type: 'webhook_call',
      payload: {
        url: targetUrl || 'https://api.example.com/webhook',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          event: triggerType,
          contact: '{{contact.phone}}',
          message: '{{message.text}}',
        },
      },
    });
    dryRunSteps.push({
      stepName: 'Déclencher le webhook externe',
      action: 'webhook_call',
      outputPreview: targetUrl
        ? `Appel HTTP sécurisé émis vers ${targetUrl}.`
        : 'Appel HTTP POST émis vers l’endpoint configuré.',
    });

    if (!targetUrl) {
      missingInformation.push('URL HTTPS cible du webhook à notifier');
    }
  }
  // Scénario E : Temporisation programmée (wait_delay)
  else if (lower.includes('attends') && (lower.includes('seconde') || lower.includes('minute') || lower.includes('heure'))) {
    const delayMatch = lower.match(/attends?\s+(\d+)\s*(seconde|secondes|minute|minutes|heure|heures)/i);
    let delaySeconds = 60;
    if (delayMatch) {
      const val = parseInt(delayMatch[1], 10);
      const unit = delayMatch[2].toLowerCase();
      if (unit.startsWith('seconde')) delaySeconds = val;
      else if (unit.startsWith('minute')) delaySeconds = val * 60;
      else if (unit.startsWith('heure')) delaySeconds = val * 3600;
    }

    steps.push({
      id: 'step_wait_delay',
      name: `Attendre ${Math.round(delaySeconds / 60)} minute(s)`,
      action_type: 'wait_delay',
      payload: {
        delay_seconds: delaySeconds,
      },
      next_step_id: 'step_delayed_followup',
    });
    dryRunSteps.push({
      stepName: 'Temporisation du workflow',
      action: 'wait_delay',
      outputPreview: `Pause de ${delaySeconds} secondes avant l'action suivante.`,
    });

    steps.push({
      id: 'step_delayed_followup',
      name: 'Envoyer le message de relance',
      action_type: 'send_private_message',
      payload: {
        text: 'Bonjour, avez-vous pu prendre connaissance de notre précédent message ?',
        recipient_phone: '{{contact.phone}}',
      },
    });
    dryRunSteps.push({
      stepName: 'Envoyer le message de relance',
      action: 'send_private_message',
      outputPreview: 'Message de relance envoyé au client après expiration du délai.',
    });
  }
  // Scénario F : Contacter un numéro tiers spécifié (Alerte / Notification directe)
  else if (targetPhone || lower.includes('contacte') || lower.includes('avertis') || lower.includes('préviens') || lower.includes('previens')) {
    const notifyName = targetPhone ? `Alerter le numéro ${targetPhone}` : 'Alerter le contact désigné';
    steps.push({
      id: 'step_notify_target',
      name: notifyName,
      action_type: 'notify_manager',
      payload: {
        title: 'Alerte Agent INNOICA',
        summary: 'Alerte client de {{contact.phone}} : "{{message.text}}"',
        phone: targetPhone || undefined,
        recipient_phone: targetPhone || undefined,
      },
      next_step_id: (lower.includes('réponds au client') || lower.includes('reponds au client') || lower.includes('dis au client')) ? 'step_reply_customer' : undefined,
    });
    dryRunSteps.push({
      stepName: notifyName,
      action: 'notify_manager',
      outputPreview: targetPhone
        ? `Message WhatsApp d’alerte transmis immédiatement au ${targetPhone}.`
        : 'Message WhatsApp transmis au destinataire.',
    });

    if (lower.includes('réponds au client') || lower.includes('reponds au client') || lower.includes('dis au client')) {
      steps.push({
        id: 'step_reply_customer',
        name: 'Informer le client de la prise en charge',
        action_type: 'send_private_message',
        payload: {
          text: 'Bonjour ! Votre message a bien été transmis à notre équipe qui vous recontacte rapidement.',
          recipient_phone: '{{contact.phone}}',
        },
      });
      dryRunSteps.push({
        stepName: 'Informer le client de la prise en charge',
        action: 'send_private_message',
        outputPreview: 'Notification automatique envoyée au client.',
      });
    }

    if (!targetPhone) {
      missingInformation.push('Numéro WhatsApp auquel transmettre l’information');
    }
  }
  // Scénario G : Rapport Quotidien Matinal
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
      next_step_id: 'step_send_report_owner',
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
  // Scénario H : Groupes WhatsApp
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
      version: 1,
      is_active_version: true,
    },
  };
}

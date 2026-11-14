-- ====================================================================
-- INNOICA WhatsApp Agents v2.0 — Seed Templates & Plans
-- ====================================================================

-- 1. SEED AGENT TEMPLATES
INSERT INTO public.agent_templates (slug, name_fr, name_en, description_fr, description_en, default_system_prompt_fr, default_system_prompt_en, icon, category)
VALUES
(
  'receptionist',
  'Agent Réceptionniste',
  'Receptionist Agent',
  'Accueille chaleureusement vos clients, présente l''entreprise, répond aux FAQ, indique les horaires et transfère vers un humain si nécessaire.',
  'Warmly welcomes your clients, introduces the company, answers FAQs, provides business hours and transfers to a human when needed.',
  'Tu es l''agent d''accueil et de réception officiel de l''entreprise.
Ton rôle est d''accueillir chaleureusement les nouveaux contacts sur WhatsApp, de répondre à leurs questions fréquentes (horaires, adresse, services, tarifs généraux) et de les orienter avec courtoisie et professionnalisme.
Règles strictes :
1. Reste poli, clair, concis et professionnel.
2. Utilise les informations de la base de connaissances. N''invente aucune information non vérifiée.
3. Si un client pose une question complexe ou demande un responsable, propose-lui immédiatement de transférer la conversation à un conseiller humain.',
  'You are the official receptionist agent of the company.
Your role is to warmly greet new contacts on WhatsApp, answer frequently asked questions (hours, address, services, general pricing), and guide them courteously and professionally.
Strict rules:
1. Stay polite, clear, concise, and professional.
2. Use the provided knowledge base. Never invent unverified facts.
3. If a customer asks a complex question or asks for a manager, immediately offer to transfer the conversation to a human advisor.',
  'UserCheck',
  'business'
),
(
  'sales',
  'Agent Commercial & Ventes',
  'Sales Agent',
  'Présente le catalogue de produits ou services, conseille les prospects, répond aux questions commerciales et collecte les intentions d''achat.',
  'Presents product/service catalogs, advises leads, answers commercial inquiries and collects purchase intentions.',
  'Tu es le conseiller commercial officiel de l''entreprise.
Ton objectif est d''accompagner les prospects, de présenter nos produits et services avec dynamisme et clarté, et de recueillir leurs besoins spécifiques pour faciliter leur achat.
Règles strictes :
1. Sois à l''écoute, enthousiaste et direct.
2. Ne survends pas et ne divulgue aucun tarif ou remise non mentionné dans tes connaissances.
3. Recueille le nom, les besoins précis et l''intention d''achat du prospect avant de transmettre le dossier à l''équipe commerciale.',
  'You are the official sales advisor of the company.
Your goal is to guide prospects, present our products and services with dynamism and clarity, and collect their specific needs to facilitate their purchase.
Strict rules:
1. Be attentive, enthusiastic, and direct.
2. Do not oversell and never disclose discounts or prices not mentioned in your knowledge base.
3. Collect the prospect''s name, precise needs, and purchase intent before handing off to the sales team.',
  'TrendingUp',
  'business'
),
(
  'support',
  'Agent Support & SAV',
  'Support & Helpdesk Agent',
  'Assiste vos clients, résout les pannes courantes, consulte la documentation technique et escalade les réclamations complexes.',
  'Assists customers, solves common issues, consults technical documentation, and escalates complex tickets.',
  'Tu es l''agent de support client et d''assistance technique.
Ton rôle est de diagnostiquer les difficultés rencontrées par les utilisateurs, de leur fournir des instructions étape par étape basées sur notre documentation et de résoudre leurs soucis rapidement.
Règles strictes :
1. Sois empathique, calme et méthodique.
2. Demande des précisions (numéro de commande, message d''erreur) si la demande est vague.
3. En cas de blocage persistant ou d''insatisfaction client, escalade immédiatement le dossier à un technicien humain.',
  'You are the customer support and technical assistance agent.
Your role is to diagnose user issues, provide step-by-step troubleshooting based on our documentation, and resolve issues promptly.
Strict rules:
1. Be empathetic, calm, and methodical.
2. Ask for specifics (order ID, error message) if the inquiry is vague.
3. In case of persistent failure or client frustration, escalate immediately to a human technician.',
  'LifeBuoy',
  'support'
),
(
  'booking',
  'Agent Réservation & Rendez-vous',
  'Booking & Appointment Agent',
  'Collecte les demandes de rendez-vous, recueille les dates et préférences des clients et transmet les dossiers pour confirmation.',
  'Collects appointment requests, gathers dates and customer preferences, and transmits bookings for human confirmation.',
  'Tu es l''agent chargé de la planification des rendez-vous et des réservations.
Ton rôle est d''enregistrer les demandes des clients avec précision : nom, date souhaitée, créneau horaire, motif du rendez-vous et coordonnées.
Règle inviolable :
N''invente JAMAIS une disponibilité en temps réel si tu n''as pas accès à un agenda synchronisé. Précise toujours au client : "Votre demande de rendez-vous a bien été prise en compte pour le [date/heure]. Notre équipe vous confirmera la réservation dans les plus brefs délais."',
  'You are the appointment scheduling and booking agent.
Your role is to accurately register client requests: name, preferred date, time slot, appointment reason, and contact details.
Inviolable rule:
NEVER invent real-time availability without access to a synchronized calendar. Always inform the customer: "Your appointment request has been recorded for [date/time]. Our team will confirm your booking shortly."',
  'CalendarCheck',
  'booking'
),
(
  'restaurant',
  'Agent Restaurant & Commandes',
  'Restaurant & Orders Agent',
  'Présente le menu du jour, répond aux questions sur les plats et ingrédients, recueille les commandes et réservations de tables.',
  'Presents the daily menu, answers questions about dishes and ingredients, collects orders and table reservations.',
  'Tu es le maître d''hôtel virtuel de notre restaurant.
Tu accueilles les clients gourmets, leur présentes la carte, les plats du jour, les boissons et les allergènes éventuels. Tu prends les commandes à emporter ou en livraison ainsi que les réservations de table.
Règles strictes :
1. Reste chaleureux et convivial.
2. Récapitule systématiquement la commande, le montant estimatif (selon le menu) et le mode de récupération avant validation.
3. Transmets la commande à l''équipe du restaurant.',
  'You are the virtual restaurant host.
You welcome guests, present the menu, specials, drinks, and allergen details. You record takeout/delivery orders and table reservations.
Strict rules:
1. Stay warm and welcoming.
2. Always recap the order items and pickup/delivery mode before concluding.
3. Hand over the details to restaurant staff.',
  'UtensilsCrossed',
  'hospitality'
),
(
  'custom',
  'Agent Personnalisé',
  'Custom Agent',
  'Créez un agent entièrement sur mesure avec vos propres instructions système, votre tonalité et vos règles spécifiques.',
  'Create a fully custom agent with your own system prompts, tone of voice, and specialized behavior.',
  'Tu es un assistant IA professionnel conçu pour représenter fidèlement l''organisation selon les instructions spécifiques fournies par ton administrateur.',
  'You are a professional AI assistant configured to faithfully represent the organization according to specific guidelines provided by your administrator.',
  'Sparkles',
  'custom'
)
ON CONFLICT (slug) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  name_en = EXCLUDED.name_en,
  description_fr = EXCLUDED.description_fr,
  description_en = EXCLUDED.description_en,
  default_system_prompt_fr = EXCLUDED.default_system_prompt_fr,
  default_system_prompt_en = EXCLUDED.default_system_prompt_en;

-- 2. SEED SUBSCRIPTION PLANS (XAF / FCFA)
INSERT INTO public.plans (slug, name_fr, name_en, description_fr, description_en, price_monthly_xaf, price_yearly_xaf, max_agents, max_connections, max_knowledge_docs, features)
VALUES
(
  'starter',
  'Starter',
  'Starter',
  'Idéal pour les indépendants et petites activités démarrant sur WhatsApp.',
  'Perfect for freelancers and small businesses launching their WhatsApp automation.',
  15000,
  150000,
  1,
  1,
  3,
  '["1 Agent IA WhatsApp", "Pairing Code sans QR", "BYOK Fournisseur IA", "Mémoire contact & conversation", "Support standard email"]'::jsonb
),
(
  'pro',
  'Professionnel',
  'Professional',
  'Conçu pour les entreprises actives cherchant à automatiser accueil, ventes et support.',
  'Designed for growing businesses automating reception, sales, and support.',
  35000,
  350000,
  3,
  3,
  20,
  '["Jusqu''à 3 Agents IA WhatsApp", "3 Numéros connectés en simultané", "Base de connaissances PDF, TXT, Web", "Double contrôle Human Takeover", "Support prioritaire WhatsApp"]'::jsonb
),
(
  'enterprise',
  'Entreprise',
  'Enterprise',
  'Pour les structures à fort trafic nécessitant des agents illimités et un accompagnement sur mesure.',
  'For high-volume organizations requiring unlimited agents and customized onboarding.',
  90000,
  900000,
  10,
  10,
  100,
  '["Agents et connexions étendus", "Scraping web et ingestion prioritaire", "SLA garanti 99.9%", "Accompagnement personnalisé INNOICA"]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  name_en = EXCLUDED.name_en,
  price_monthly_xaf = EXCLUDED.price_monthly_xaf,
  price_yearly_xaf = EXCLUDED.price_yearly_xaf,
  max_agents = EXCLUDED.max_agents,
  max_connections = EXCLUDED.max_connections,
  max_knowledge_docs = EXCLUDED.max_knowledge_docs,
  features = EXCLUDED.features;

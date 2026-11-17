import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Realtime & Unslop Senior UX Verification Suite', () => {
  const rootDir = process.cwd();

  it('1. BRAND IDENTITY: verifies logo asset and integration across all key views', () => {
    const logoPath = path.join(rootDir, 'apps/web/public/images/innoica-logo.jpg');
    expect(fs.existsSync(logoPath)).toBe(true);
    const stats = fs.statSync(logoPath);
    expect(stats.size).toBeGreaterThan(10000); // Original ~59KB cybernetic hexagon badge

    const brandLogoCode = fs.readFileSync(path.join(rootDir, 'apps/web/src/components/brand-logo.tsx'), 'utf-8');
    expect(brandLogoCode).toContain('/images/innoica-logo.jpg');
    expect(brandLogoCode).toContain('INNOICA');

    // Layout favicon
    const layoutCode = fs.readFileSync(path.join(rootDir, 'apps/web/src/app/[locale]/layout.tsx'), 'utf-8');
    expect(layoutCode).toContain('/images/innoica-logo.jpg');

    // Auth views using BrandLogo and zinc/graphite theme
    const loginCode = fs.readFileSync(path.join(rootDir, 'apps/web/src/app/[locale]/(auth)/login/page.tsx'), 'utf-8');
    expect(loginCode).toContain('BrandLogo');
    expect(loginCode).not.toContain('bg-blue-600');
    expect(loginCode).not.toContain('slate-');

    const registerCode = fs.readFileSync(path.join(rootDir, 'apps/web/src/app/[locale]/(auth)/register/page.tsx'), 'utf-8');
    expect(registerCode).toContain('BrandLogo');
    expect(registerCode).not.toContain('bg-blue-600');
    expect(registerCode).not.toContain('slate-');
  });

  it('2. REAL-TIME INBOX: verifies sender_type detection and non-stale closure', () => {
    const inboxCode = fs.readFileSync(
      path.join(rootDir, 'apps/web/src/app/[locale]/(dashboard)/conversations/inbox-client.tsx'),
      'utf-8'
    );

    // Must NOT check raw newMsg.direction === 'inbound' which was undefined in Supabase schema
    expect(inboxCode).toContain("newMsg.sender_type === 'contact'");
    // Must use ref to avoid stale closure on selectedConvId
    expect(inboxCode).toContain('selectedConvIdRef.current');
    expect(inboxCode).toContain('selectedConvIdRef = useRef');
  });

  it('3. REAL-TIME WHATSAPP: verifies stable client instance and DELETE handling', () => {
    const waClientCode = fs.readFileSync(
      path.join(rootDir, 'apps/web/src/app/[locale]/(dashboard)/whatsapp/whatsapp-client.tsx'),
      'utf-8'
    );

    // Must use useMemo for supabase client to prevent tear-down on every render
    expect(waClientCode).toContain('useMemo(() => createClient(), [])');
    // Must handle DELETE event
    expect(waClientCode).toContain("payload.eventType === 'DELETE'");
    // Must use ref for selectedAgentId to prevent reconnect thrashing
    expect(waClientCode).toContain('selectedAgentIdRef.current');
  });

  it('4. REAL-TIME DASHBOARD & MIGRATION: verifies table publications and workspace agent scoping', () => {
    const dashboardCode = fs.readFileSync(
      path.join(rootDir, 'apps/web/src/app/[locale]/(dashboard)/dashboard/dashboard-overview-client.tsx'),
      'utf-8'
    );

    // Scoped agent checks for conversations
    expect(dashboardCode).toContain('agentIdsRef');
    expect(dashboardCode).toContain('agentIdsRef.current.includes');
    expect(dashboardCode).toContain("table: 'whatsapp_connections'");
    expect(dashboardCode).toContain("table: 'agents'");
    expect(dashboardCode).toContain("table: 'execution_logs'");

    // Migration publication includes agents and execution_logs
    const migPath = path.join(rootDir, 'packages/database/migrations/20261116000005_realtime_agents_and_logs.sql');
    expect(fs.existsSync(migPath)).toBe(true);
    const migContent = fs.readFileSync(migPath, 'utf-8');
    expect(migContent).toContain("'agents'");
    expect(migContent).toContain("'execution_logs'");
    expect(migContent).toContain('supabase_realtime');
  });

  it('5. REAL-TIME SUBSCRIPTIONS & ADMIN: verifies payment declaration sync', () => {
    const subCode = fs.readFileSync(
      path.join(rootDir, 'apps/web/src/app/[locale]/(dashboard)/subscription/subscription-client.tsx'),
      'utf-8'
    );
    expect(subCode).toContain("table: 'payment_declarations'");
    expect(subCode).toContain("payload.new.status === 'approved'");

    const adminCode = fs.readFileSync(
      path.join(rootDir, 'apps/web/src/app/[locale]/(dashboard)/admin/admin-client.tsx'),
      'utf-8'
    );
    expect(adminCode).toContain("table: 'payment_declarations'");
    expect(adminCode).toContain("table: 'execution_logs'");
  });

  it('6. LANDING PAGE SENIOR UX & UNSLOP: verifies architecture diagram, mockups, and waveforms', () => {
    const landingCode = fs.readFileSync(
      path.join(rootDir, 'apps/web/src/components/landing-client.tsx'),
      'utf-8'
    );

    // Architecture section
    expect(landingCode).toContain('Pipeline Technologique Souverain');
    expect(landingCode).toContain('Transcription Locale');
    expect(landingCode).toContain('BYOK');
    expect(landingCode).toContain('Pairing Code');

    // High fidelity mockups
    expect(landingCode).toContain('innoica.studio — Inbox / Workspace Douala HQ');
    expect(landingCode).toContain('innoica.studio — Connexion WhatsApp / Baileys Pairing Code');
    expect(landingCode).toContain('innoica.studio — Base de Connaissances & RAG Vectoriel');

    // Phone Pairing screen simulation
    expect(landingCode).toContain('WhatsApp • 100%');
    expect(landingCode).toContain('Lier avec un numéro');
    expect(landingCode).toContain('INNO-8492');

    // Interactive audio waveform
    expect(landingCode).toContain('animate-wave-bar');
    expect(landingCode).toContain('simAudioPlaying');

    // Gamification & ROI
    expect(landingCode).toContain("Score d'Efficacité Opérationnelle");
    expect(landingCode).toContain('testedVocal');
    expect(landingCode).toContain('testedTakeover');
    expect(landingCode).toContain('3 500 FCFA');

    // Unslop checks: zero slop classes
    expect(landingCode).not.toContain('card-3d-tilt');
    expect(landingCode).not.toContain('perspective-3d');
    expect(landingCode).not.toContain('animate-float-slow');
    expect(landingCode).not.toContain('bg-purple-100');
  });
});

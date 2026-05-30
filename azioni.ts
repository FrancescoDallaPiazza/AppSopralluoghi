feat: checklist come form configurabile + report cliente/interno

Tappa 1 - schema + seed
  supabase/migrations/002_checklist_form_model.sql  (modello generalizzato)
  supabase/migrations/003_checklist_templates.sql   (#1 Simulazione ispettiva, #3 Audit periodico)
  supabase/migrations/004_checklist_dvr.sql         (#2 DVR/Consulenza, 122 voci)
  supabase/migrations/005_report_bucket.sql         (bucket privato 'report')
  --> applicare in ordine: 002, 003, 004, 005

Tappa 2 - renderer di form (compilazione)
  src/lib/types.ts        (tipi del modello: VoceTipo, OpzioneVoce, VoceConfig, EsitoVoce.valore, periodicita)
  src/lib/compilazione.ts (carica albero voci+config, semina top-level, figli/rilievi on-demand, stato logico)
  src/lib/azioni.ts        (COLONNE_AZIONE + periodicita_mesi)
  src/Compilazione.tsx     (renderer: scelta/multiscelta/testo/data/numero/slider/foto/rilievo,
                            sotto-domande condizionali, scadenza ricorrente, giro precedente)

Tappa 3 - report
  supabase/functions/_shared/cors.ts
  supabase/functions/genera-report/{index,report-data,report-html}.ts
  src/lib/report.ts        (helper client -> URL firmato)
  src/MieiSopralluoghi.tsx (bottoni Report Cliente/Interno sui completati)
  --> deploy: supabase functions deploy genera-report
      (PDF opzionale: secret PDF_SERVICE_URL/PDF_SERVICE_TOKEN; email: RESEND_API_KEY/REPORT_FROM_EMAIL)

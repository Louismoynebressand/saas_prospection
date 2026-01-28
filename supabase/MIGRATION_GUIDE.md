# Guide d'Exécution des Migrations Cold Email

## ⚠️ IMPORTANT - À lire avant de commencer

### Pré-requis
- [ ] Backup de la base de données (via Supabase Dashboard)
- [ ] Accès Supabase SQL Editor
- [ ] Aucune campagne en cours de création (éviter conflits)

### Ordre d'Exécution STRICT

Les migrations DOIVENT être exécutées dans cet ordre :

```
1. migrate_cold_email_phase1_cleanup.sql
2. migrate_cold_email_phase2_critical_fields.sql
3. migrate_cold_email_phase3_nice_to_have.sql (optionnel)
4. migrate_cold_email_generations.sql (optionnel)
```

---

## 📋 Phase 1: Cleanup (OBLIGATOIRE)

**Fichier**: `migrate_cold_email_phase1_cleanup.sql`

**Ce que ça fait**:
- Migre les données FR → EN
- Vérifie qu'aucune donnée ne sera perdue
- Supprime les colonnes françaises obsolètes
- Renomme toutes les colonnes en anglais

**Résultat attendu**:
```
NOTICE: Migration OK - Aucune perte de données
COMMIT
```

**Vérification**:
```sql
SELECT COUNT(*) FROM cold_email_campaigns;
-- Doit retourner le même nombre qu'avant
```

---

## 📋 Phase 2: Champs Critiques (OBLIGATOIRE)

**Fichier**: `migrate_cold_email_phase2_critical_fields.sql`

**Ce que ça fait**:
- Ajoute `objective` (but de la campagne)
- Ajoute bloc signature (6 colonnes)
- Ajoute ciblage amélioré (`target_sectors`, `target_job_titles`)
- Ajoute paramètres email (`email_length`, `language`)
- Ajoute `status` (DRAFT/ACTIVE/PAUSED/ARCHIVED)

**Résultat attendu**:
```
Retourne 5 lignes avec les nouvelles colonnes:
- objective
- signature_name
- target_sectors
- email_length
- status
```

---

## 📋 Phase 3: Nice-to-Have (OPTIONNEL)

**Fichier**: `migrate_cold_email_phase3_nice_to_have.sql`

**Ce que ça fait**:
- Ajoute `differentiators` (USP)
- Ajoute `proof_points` (preuves sociales)
- Ajoute `case_studies`, `guarantees`, `pricing_hint`
- Ajoute `objection_handling`

**Quand l'exécuter**: Maintenant ou plus tard (pas bloquant pour l'UI)

---

## 📋 Phase 4: Amélioration Generations (OPTIONNEL)

**Fichier**: `migrate_cold_email_generations.sql`

**Ce que ça fait**:
- Ajoute `status`, `variant_number`
- Ajoute tracking (`sent_at`, `opened_at`, `replied_at`)
- Ajoute `feedback_score`
- Crée les index de performance

**Quand l'exécuter**: Plus tard (pas urgent)

---

## ✅ Checklist d'Exécution

### Étape 1: Backup
```
Supabase Dashboard → Database → Backups → Create Backup
```

### Étape 2: Ouvrir SQL Editor
```
Supabase Dashboard → SQL Editor → New Query
```

### Étape 3: Exécuter Phase 1
1. Copier le contenu de `migrate_cold_email_phase1_cleanup.sql`
2. Coller dans SQL Editor
3. Cliquer "Run"
4. Vérifier le message `NOTICE: Migration OK`
5. ✅ Confirmer ici

### Étape 4: Exécuter Phase 2
1. Copier le contenu de `migrate_cold_email_phase2_critical_fields.sql`
2. Coller dans SQL Editor
3. Cliquer "Run"
4. Vérifier que 5 colonnes sont retournées
5. ✅ Confirmer ici

### Étape 5: (Optionnel) Phases 3 & 4
Si vous voulez les exécuter maintenant, même procédure.

---

## 🚨 En cas d'erreur

### "column already exists"
➡️ Normal si vous relancez le script. Vérifiez que la migration a déjà été appliquée :
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'cold_email_campaigns' AND column_name = 'objective';
```

### "cannot drop column because other objects depend on it"
➡️ Il y a une vue/trigger qui utilise la colonne. Identifiez-la :
```sql
SELECT * FROM information_schema.view_column_usage 
WHERE table_name = 'cold_email_campaigns';
```

### "data type mismatch"
➡️ Contactez-moi, je créerai un script de conversion.

---

## 📞 Après Exécution

**Dites-moi**:
1. ✅ "Phase 1 OK"
2. ✅ "Phase 2 OK"
3. (Optionnel) "Phase 3 OK" / "Phase 4 OK"

Ensuite je commence l'UI multi-steps ! 🚀

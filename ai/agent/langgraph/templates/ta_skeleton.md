# Technische Analyse: {Title}

## 1. Scope

### In scope
- {item}

### Out of scope
- {item}

## 2. Assumptions
- {aanname}

## 3. Open Questions
- {open vraag}

## 4. Domain Model

### Entiteiten
| Entiteit | Velden | Constraints |
|----------|--------|-------------|
| {Naam}   | {veld}: {type} | {constraint} |

## 5. API Design

### Endpoints
| Method | Path | Beschrijving |
|--------|------|--------------|
| POST   | /api/{resource} | {beschrijving} |

### Request DTO
```json
{
  "{veld}": "{type}"
}
```

### Response DTO
```json
{
  "{veld}": "{type}"
}
```

### Error formaat
```json
{
  "correlationId": "uuid",
  "code": "ERROR_CODE",
  "message": "Beschrijving",
  "fieldErrors": []
}
```

## 6. Backend Design

### Lagen
- **Controller**: {verantwoordelijkheid}
- **Service**: {verantwoordelijkheid}
- **Repository**: {verantwoordelijkheid}

### Klassen
| Klasse | Verantwoordelijkheid |
|--------|---------------------|
| {Naam} | {verantwoordelijkheid} |

## 7. Frontend Design

### Routes
- `{pad}` — {beschrijving}

### Componenten
| Component | Verantwoordelijkheid |
|-----------|---------------------|
| {Naam}    | {verantwoordelijkheid} |

## 8. Security & Privacy
- {security opmerking}

## 9. Observability
- Logging: {wat wordt gelogd}
- Metrics: {wat wordt gemeten}

## 10. Performance & Scalability
- {performance opmerking}

## 11. Test Strategy

### Unit tests
- {wat wordt getest}

### Integration tests
- {wat wordt getest}

### E2E tests
- {wat wordt getest}

## 12. Acceptance Criteria

| AC-ID | REQ | Gegeven | Wanneer | Dan | Testtype |
|-------|-----|---------|---------|-----|----------|
| AC-001-1 | REQ-001 | {context} | {actie} | {verwacht resultaat} | integration |
| AC-001-2 | REQ-001 | {ongeldige context} | {actie} | {foutmelding} | integration |

## 13. Traceability Matrix

| REQ | Backend | Frontend | Tests |
|-----|---------|----------|-------|
| REQ-001 | {klasse} | {component} | {test} |

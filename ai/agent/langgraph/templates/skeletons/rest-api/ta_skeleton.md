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
| GET    | /api/{resource} | {beschrijving} |
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

- **Controller**: Behandelt inkomende HTTP-requests en valideert basisinput.
- **Service**: Bevat de business logica en orkestreert repositories.
- **Repository**: Verantwoordelijk voor data-access operaties.

### Klassen

| Klasse | Verantwoordelijkheid |
|--------|---------------------|
| {Resource}Controller | Exposeert REST endpoints. |
| {Resource}Service | Implementeert business logica. |
| {Resource}Repository | Data-access operaties. |
| {Resource} | JPA entiteit. |
| {Create/Update}Request | Request DTO. |
| {Resource}Response | Response DTO. |
| {Resource}NotFoundException | Exception bij ontbrekende resource. |
| GlobalExceptionHandler | Centrale exception handler. |
| CorrelationIdFilter | Beheert correlation IDs. |

## 7. Security & Privacy

- Endpoints vereisen authenticatie (bearer token).
- Input validatie aan de backend.

## 8. Observability

- **Logging**: Inkomende requests, business events, fouten met correlationId.
- **Metrics**: Request count, response tijd (p95), error rate per endpoint.

## 9. Performance & Scalability

- Database indexen op veelgebruikte filtervelden.
- p95 responstijd < 300ms.

## 10. Test Strategy

### Unit tests

- Validators en business logica in de service laag.

### Integration tests

- Volledige request/response cyclus per endpoint.
- Successcenario's (2xx) en foutscenario's (4xx, 5xx).

### E2E tests

- Gebruikersflow van aanmaken tot ophalen.

## 11. Acceptance Criteria

| AC-ID | REQ | Gegeven | Wanneer | Dan | Testtype |
|-------|-----|---------|---------|-----|----------|
| AC-001-1 | REQ-001 | {context} | {actie} | {verwacht resultaat} | integration |
| AC-001-2 | REQ-001 | {ongeldige context} | {actie} | {foutmelding} | integration |

## 12. Traceability Matrix

| REQ | Backend | Tests |
|-----|---------|-------|
| REQ-001 | {klasse} | {test} |

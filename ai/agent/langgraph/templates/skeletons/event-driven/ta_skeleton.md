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

### Events

| Event | Trigger | Payload velden |
|-------|---------|---------------|
| {EventNaam} | {wanneer} | {velden} |

## 5. Messaging Design

### Topics / Queues

| Topic/Queue | Producer | Consumer | Beschrijving |
|-------------|----------|----------|--------------|
| {naam} | {service} | {service} | {wat er op gepubliceerd wordt} |

### Event schema

```json
{
  "eventType": "{EventNaam}",
  "occurredAt": "ISO-8601 timestamp",
  "payload": {
    "{veld}": "{type}"
  }
}
```

### Error handling

- Dead letter queue: `{topic}-dlq`
- Retry strategie: exponential backoff, max {n} pogingen
- DLQ monitoring: alert bij berichten in DLQ

## 6. Backend Design

### Lagen

- **Producer**: Publiceert events na succesvolle business operaties.
- **Consumer**: Verwerkt inkomende events en voert acties uit.
- **Repository**: Persisteert de verwerkte data.

### Klassen

| Klasse | Verantwoordelijkheid |
|--------|---------------------|
| {Event}Producer | Publiceert {EventNaam} naar {topic}. |
| {Event}Consumer | Verwerkt inkomende {EventNaam} events. |
| {Event}Handler | Business logica bij ontvangst van event. |
| {Resource}Repository | Data-access operaties. |
| {EventNaam} | Event payload klasse. |
| DeadLetterHandler | Verwerkt berichten uit de DLQ. |

## 7. Security & Privacy

- Events bevatten geen gevoelige persoonsgegevens tenzij versleuteld.
- Authenticatie via service-to-service credentials.

## 8. Observability

- **Logging**: Elk gepubliceerd en ontvangen event met correlationId en eventId.
- **Metrics**: Events per seconde, verwerkingstijd, DLQ grootte, retry count.
- **Alerting**: Alert bij DLQ-berichten, bij hoge verwerkingstijd (p95 > 5s).

## 9. Performance & Scalability

- Consumer horizontaal schaalbaar via consumer groups.
- Idempotente verwerking — dubbele events hebben geen side-effects.
- Backpressure mechanisme bij hoge load.

## 10. Test Strategy

### Unit tests

- Producer: verifieer dat events correct worden samengesteld.
- Consumer/Handler: verifieer business logica bij event ontvangst.
- Idempotentie: dubbele events produceren geen dubbele verwerking.

### Integration tests

- Producer → topic → consumer flow met embedded broker.
- DLQ flow bij verwerkingsfouten.
- Retry mechanisme bij tijdelijke fouten.

### E2E tests

- Volledige event flow van trigger tot verwerkte data in database.

## 11. Acceptance Criteria

| AC-ID | REQ | Gegeven | Wanneer | Dan | Testtype |
|-------|-----|---------|---------|-----|----------|
| AC-001-1 | REQ-001 | {context} | {actie} | {verwacht resultaat} | integration |
| AC-001-2 | REQ-001 | {ongeldige context} | {actie} | {foutmelding} | integration |

## 12. Traceability Matrix

| REQ | Producer/Consumer | Tests |
|-----|-------------------|-------|
| REQ-001 | {klasse} | {test} |

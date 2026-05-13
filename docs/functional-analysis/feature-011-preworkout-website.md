# Feature-feature-011-preworkout-website: Functionele analyse - Pre-workout Webshop

## Project
Uitgebreide versie met Figma-level UI designs, UML diagrams, database ERD en API contracten.

| Project | Full stack webshop voor pre-workout supplementen |
|---|---|
| Primaire actor | Klant |
| Secundaire actor | Admin, betalingsprovider |

## 1. Samenvatting
De applicatie is een traditionele webshop waarin klanten pre-workout producten kunnen zoeken, filteren, bekijken, toevoegen aan hun winkelmand, afrekenen en hun bestelgeschiedenis opvolgen. Admins beheren producten, voorraad en bestellingen.

Belangrijkste modules: productcatalogus, productdetail, winkelmand, checkout, betaling, account, admin dashboard, orderbeheer en API-laag.

## 2. Figma-level UI designs
De onderstaande schermen tonen een realistisch visueel ontwerp voor de belangrijkste klantflows. De stijl gebruikt duidelijke productcards, sterke CTA-knoppen, filterblokken en een checkout met overzicht en order summary.

### Homepage + shop overzicht
![Homepage + shop overzicht](feature-011-preworkout-website/page-2.png)

### Productdetailpagina
![Productdetailpagina](feature-011-preworkout-website/page-3.png)

### Checkout
![Checkout](feature-011-preworkout-website/page-4.png)

## 3. Uitgebreide UML diagrams
De UML diagrammen ondersteunen de analyse van gedrag, architectuurcomponenten en deployment.

### Sequence diagram - checkout en betaling
Deze flow toont hoe klant, frontend, API, database en betalingsprovider samenwerken bij afrekenen.
![Sequence diagram - checkout en betaling](feature-011-preworkout-website/page-5.png)

### Component diagram
Dit diagram toont de logische applicatiecomponenten en hun verantwoordelijkheden.
![Component diagram](feature-011-preworkout-website/page-6.png)

### Deployment diagram
Dit diagram toont een mogelijke cloud deployment met client, CDN, app service, database en payment gateway.
![Deployment diagram](feature-011-preworkout-website/page-7.png)

## Database ERD
De database bestaat uit gebruikers, producten, winkelmanditems, bestellingen, orderregels en betalingen. De belangrijkste relaties zijn User 1-N Order, Order 1-N OrderItem, Product 1-N OrderItem, User 1-N CartItem en Order 1-1 Payment.
![Database ERD](feature-011-preworkout-website/page-8.png)

## API contracten
Onderstaande contracten geven een concrete basis voor backend implementatie. Alle endpoints onder /admin vereisen de rol Admin. Klantgebonden endpoints vereisen een geldige JWT access token.

| Endpoint | Request | Response |
|---|---|---|
| GET /api/products | Query: search, flavor, minPrice, maxPrice, caffeineMin, caffeineMax, inStock, sort, page, pageSize | 200: Paged list van actieve producten met id, name, price, imageURL, stockStatus |
| GET /api/products/{id} | Path: product id | 200: Productdetail; 404: product niet gevonden |
| POST /api/auth/register | firstName, lastName, email, password | 201: user + token; 400: email: beest al |
| POST /api/auth/login | email, password | 200: access token + user; 401: ongeldige login |
| GET /api/cart | JWT token | 200: cart items + totals |
| POST /api/cart/items | JWT token, productId, quantity | 201: cart item; 400: quantity ongedig, 409: onvoldoende voorraad |
| PATCH /api/cart/items/{id} | quantity | 200: aangepast item; 404: item niet gevonden |
| DELETE /api/cart/items/{id} |  | 204: verwijderd |
| POST /api/orders | Path: cart item, shippingAddress, paymentMethod | 201: Order Pending + paymentUrl; 400: leeg mandje; 409: voorraadprobleem |
| GET /api/orders/me | JWT token | 200: lijst met eigen bestellingen |
| POST /api/payments/webhook | Provider payload met transactionReference en status | 200: webhook verwerkt; update orderstatus |
| POST /api/admin/products | name, description, price, flavor, caffeineMg, servings, stock, imageURL | 201: nieuw product; 400: validatiefout |
| PUT /api/admin/products/{id} | Volledige productupdate | 200: aangepast product; 404: product niet gevonden |
| PATCH /api/admin/orders/{id}/status | status | 200: aangepaste bestelling; 400: ongeldige statusovergang |

### Acceptance criteria - kernflows
REQ-001: Producten bekijken
AC-001-1: Gegeven actieve producten bestaan, wanneer de klant de shop opent, dan ziet hij producten met naam, prijs, afbeelding en voorraadstatus.
AC-001-2: Gegeven actieve producten bestaan, wanneer de klant de shop opent, dan verschijnt een lege staat met melding.

REQ-002: Product toevoegen aan winkelmand
AC-002-1: Gegeven voldoende voorraad, wanneer de klant een hoeveelheid toevoegt, dan verschijnt het product in het winkelmandje.
AC-002-2: Gegeven de hoeveelheid is dan voorraad, wanneer de klant toevoegt, dan wordt de actie geweigerd met foutmelding.

REQ-003: Bestelling plaatsen
AC-003-1: Gegeven een gevuld winkelmandje en geldig adres, wanneer de klant bevestigt, dan wordt een order aangemaakt met status Pending.
AC-003-2: Gegeven een leeg mandje, wanneer de klant afrekent, dan wordt checkout geblokkeerd.

REQ-004: Online betaling
AC-004-1: Gegeven een geldige order, wanneer betaling succesvol is, dan wordt status Paid.
AC-004-2: Gegeven betaling mislukt, wanneer provider weigert, dan blijft order Pending of wordt Cancelled.

REQ-005: Admin productbeheer
AC-005-1: Gegeven adminrechten, wanneer admin product aanmaakt, dan verschijnt het in de catalogus.
AC-005-2: Gegeven geen adminrechten, wanneer gebruiker admin endpoint aanroept, dan krijgt hij 403 Forbidden.

### Non-functional requirements
NFR-001: Responsive op desktop, tablet en mobiel.
NFR-002: Productoverzicht laadt binnen 2 seconden bij normale belasting.
NFR-003: Wachtwoorden worden gehasht opgeslagen.
NFR-004: Betalingsgegevens worden niet lokaal opgeslagen; de betalingsprovider verwerkt kaart- of bankgegevens.
NFR-005: API endpoints gebruiken validatie, authenticatie en autorisatie.
NFR-006: Database bevat constraints voor unieke e-mailadressen, unieke payment references en geldige hoeveelheden.
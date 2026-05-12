# Feature-feature-012-kledij-webshop: Functionele Analyse - Kleding Webshop

## Veld
![Veld](feature-012-kledij-webshop/page-1.png)

## 1. Samenvatting
De applicatie is een full stack kledingwebshop waarin klanten kledingstukken kunnen zoeken, filteren, bekijken, toevoegen aan hun winkelmand, afrekenen en hun bestellingen opvolgen. Admins beheren producten, categorieën, maten, voorraad, bestellingen en retouraanvragen.

Belangrijkste modules: productcatalogs, productdetail, winkelmand, checkout, betaling, account, admin dashboard, voorraadbeheer, orderbeheer, retourbeheer en API-laag.

## 2. Doel en scope
Als klant wil ik eenvoudig kleding kunnen vinden, kiezen in de juiste maat en veilig bestellen zodat ik snel een volledige outfit kan kopen.

In scope: zoeken/filteren, productdetail, winkelmand, checkout, betaling, account, orderhistoriek, admin productbeheer, voorraadbeheer en retouraanvraag.

Out of scope: fysieke winkelkassa, loyalty programma, marketplace voor externe verkopers en geavanceerde AI styling assistant.

## 3. Actoren
Klant: bekijkt producten, plaatst bestellingen en volgt leveringen op.
Admin: beheert catalogus, voorraad, bestellingen en retouren.
Betalingsprovider: verwerkt betalingen via een hosted checkout.
Verzendsdienst: ontvangt verzendinformatie en levert trackinggegevens terug.

## 4. Figma-level UI designs
De onderstaande schermen tonen realistische designs voor de belangrijkste klantflow. De visuele stijl gebruikt productcards, duidelijke CTA-knoppen, filterblokken en een checkout met gescheiden verzendgegevens en order summary.

![Homepage + shop overzicht](feature-012-kledij-webshop/page-3.png)

![Productdetailpagina](feature-012-kledij-webshop/page-4.png)

![Checkout en order summary](feature-012-kledij-webshop/page-5.png)

## 5. Uitgebreide UML diagrams
De UML diagrammen ondersteunen de analyse van gedrag, componenten en deployment.

![Sequence diagram - checkout en betaling](feature-012-kledij-webshop/page-6.png)

![Component diagram](feature-012-kledij-webshop/page-7.png)

![Deployment diagram](feature-012-kledij-webshop/page-8.png)

## 6. Domain model
Het domeinmodel beschrijft de belangrijkste concepten binnen de kledingwebshop en hun relaties. Het model focust op betekenisvolle businessobjecten, niet op technische database details.

![Domain model](feature-012-kledij-webshop/page-9.png)

| Domeinconcept | Beschrijving |
|---|---|
| User | Een geregistreerde gebruiker met klant- of adminrol. |
| ClothingItem | Een verkoopbaar kledingstuk met naam, prijs, categorie, kleur en beschikbare maten. |
| Category | Een groep kledingstukken zoals Hoodies, Jeans, Jackets of Accessories. |
| CartItem | Een gekozen product in het winkelmandje met maat, kleur en hoeveelheid. |
| Order | Een geplaatste bestelling met status, totaalprijs en verzendadres. |
| OrderLine | Een individuele lijn binnen een bestelling. |
| Payment | De betaling die gekoppeld is aan een exact een bestelling. |
| ReturnRequest | Een aanvraag om een geleverd product te retourneren. |

## 7. Database ERD
De database bestaat uit gebruikers, adressen, categorieën, kledingstukken, winkelmanditems, bestellingen, orderregels en retrels. Belangrijke relaties zijn User 1-N Order, Order 1-N OrderLine, ClothingItem 1-N OrderLine, User 1-N CartItem en Order 1-1 Payment.

![Database ERD](feature-012-kledij-webshop/page-10.png)

| Entiteit | Belangrijkste velden | Constraints |
|---|---|---|
| User | id, firstName, lastName, email, passwordHash, role, createdAt | email unique; passwordHash verplicht; role in Customer/Admin |
| ClothingItem | id, categoryId, name, description, price, color, imageUrl, isActive | price > 0; categoryId verplicht |
| Inventory | id, clothingItemId, size, quantity | quantity >= 0; unieke combinatie clothingItemId + size |
| CartItem | id, userId, clothingItemId, quantity, size, color | quantity > 0; quantity mag voorraad niet overschrijden |
| Order | id, userId, addressId, totalPrice, status, createdAt | status in Pending/Paid/Shipped/Delivered/Cancelled |
| Payment | id, orderId, provider, status, transactionRef | orderId uniek; transactionRef uniek |
| ReturnRequest | id, orderId, reason, status, requestedAt | alleen mogelijk voor geleverde bestellingen |

## 8. Requirements
| ID | Requirement |
|---|---|
| REQ-001 | De klant kan actieve kledingproducten bekijken in een productoverzicht. |
| REQ-002 | Klanten kunnen producten filteren op categorie, maat, kleur, prijs en beschikbaarheid. |
| REQ-003 | De klant kan een productdetailpagina openen met prijs, beschrijving, beschikbare maten en voorraadstatus. |
| REQ-004 | De klant kan een product met gekozen maat en kleur toevoegen aan het winkelmandje. |
| REQ-005 | De klant kan afrekenen via een checkout met verzendgegevens, order summary en betaalmethode. |
| REQ-006 | De klant kan zijn bestelgeschiedenis en orderstatus bekijken. |
| REQ-007 | De klant kan producten, categorieën en orders beheren. |
| REQ-008 | De admin kan bestellingen openen en retouraanvragen aanmaken. |
| REQ-009 | De klant kan een retouraanvraag indienen voor een geleverde bestelling. |

## 9. Business rules
| ID | Business rule |
|---|---|
| BR-001 | Een product kan alleen worden besteld wanneer de gekozen maat op voorraad is. |
| BR-002 | De knop Toevoegen aan winkelmand wordt disabled wanneer de gekozen maat/kleur niet beschikbaar is. |
| BR-003 | Een bestelling initieert status 'Pending' en wordt pas Paid na succesvolle webhook van de betalingsprovider. |
| BR-004 | Voorraad wordt gereserveerd bij ordercreatie en definitief verminderd na een succesvolle betaling. |
| BR-005 | Een klant kan alleen bestellingen bekijken. |
| BR-006 | Admin endpoints zijn alleen toegankelijk voor gebruikers met rol Admin. |
| BR-007 | Retour aanvragen kan alleen bij een bestelling met status 'Delivered' en binnen 14 dagen na levering. |

## 10. API contracten
Alle endpoints onder /admin vereisen de rol Admin. Klantgebonden endpoints vereisen een geldige JWT access token.

| Endpoint | Request | Response |
|---|---|---|
| GET /api/clothes | Query: search, category, size, color, minPrice, maxPrice, inStock, sort, page, pageSize | 200: paginated list met id, name, price, imageUrl, availableSizes, stockStatus |
| GET /api/clothes/{id} | Path: clothing item id | 200: productdetail; 404: product niet gevonden |
| POST /api/auth/register | firstName, lastName, email, password | 201: user + token; 409: email bestaat al |
| POST /api/auth/login | email, password | 201: user + token; 401: ongeldige login |
| GET /api/cart | JWT token | 200: cart items + totals |
| POST /api/cart/items | clothingItemId, quantity, size, color | 201: cart item; 400: quantity ongeldig; 409: onvoldoende voorraad |
| PATCH /api/cart/items/{id} | quantity, size | 200: aangepast item; 404: item niet gevonden |
| DELETE /api/cart/items/{id} | Path: cart item id | 204: verwijderd |
| POST /api/orders | addressId, paymentMethod | 201: order Pending + paymentUrl; 400: leeg mandje; 409: voorraadprobleem |
| GET /api/orders/me | JWT token | 200: lijst met eigen bestellingen |
| POST /api/payments/webhook | Provider payload met transactionReference en status | 200: webhook verwerkt; update orderstatus |
| POST /api/returns | orderId, orderLineId, reason | 201: retouraanvraag; 400: niet toegelaten; 404: order niet gevonden |
| POST /api/admin/clothes | name, description, price, categoryId, color, imageUrl, inventory | 201: nieuw product; 400: validatiefout |
| PUT /api/admin/clothes/{id} | Volledige productupdate | 200: aangepast product; 404: product niet gevonden |
| PATCH /api/admin/orders/{id}/status | status | 200: aangepaste bestelling; 400: ongeldige orderstatusovergang |

## 11. Acceptance criteria - kernflows
### REQ-001: Producten bekijken
AC-001-1: Gegeven actieve producten bestaan, wanneer de klant de shop opent, dan ziet hij producten met naam, prijs, afbeelding en voorraadstatus.
AC-001-2: Gegeven geen actieve producten bestaan, wanneer de klant de shop opent, dan verschijnt een lege staat met melding.

### REQ-002: Product filteren
AC-002-1: Gegeven producten met verschillende categorieën bestaan, wanneer de klant filtert op Hoodies, dan worden alleen hoodies getoond.
AC-002-2: Gegeven geen producten voldoen aan de filters, wanneer de klant filtert, dan verschijnt een duidelijke lege staat.

### REQ-004: Product toevoegen aan winkelmand
AC-004-1: Gegeven voldoende voorraad, wanneer de klant maat en kleur kiest en toevoegt, dan verschijnt het product in het winkelmandje.
AC-004-2: Gegeven de gekozen maat niet op voorraad is, wanneer de klant probeert toe te voegen, dan wordt de actie geblokkeerd met foutmelding.

### REQ-005: Bestelling plaatsen
AC-005-1: Gegeven een gevuld winkelmandje en geldig adres, wanneer de klant bevestigt, dan wordt een order aangemaakt met status Pending.
AC-005-2: Gegeven een lege mand, wanneer de klant afrekent, dan wordt checkout geblokkeerd.

### REQ-007: Admin productbeheer
AC-007-1: Gegeven adminrechten, wanneer admin een product aanmaakt, dan verschijnt het in de catalogus.
AC-007-2: Gegeven geen adminrechten, wanneer gebruiker een admin endpoint aanroept, dan krijgt hij 403 Forbidden.

## 12. Non-functional requirements
| ID | Non-functional requirement |
|---|---|
| NFR-001 | Responsive op desktop, tablet en mobiel. |
| NFR-002 | Productoverzicht laadt binnen 2 seconden bij normale belasting. |
| NFR-003 | Wachtwoorden worden gehasht opgeslagen. |
| NFR-004 | Betalingsgegevens worden niet lokaal opgeslagen; de betaalprovider verwerkt kaart- of bankgegevens. |
| NFR-005 | API endpoints gebruiken validatie, authenticatie en autorisatie. |
| NFR-006 | Database bevat constraints voor unieke e-mailadressen, unieke payment references en geldige hoeveelheden. |
| NFR-007 | Productafbeeldingen worden geoptimaliseerd voor snelle laadtijden. |
| NFR-008 | De applicatie logt kritieke fouten zonder gevoelige klantgegevens op te slaan. |
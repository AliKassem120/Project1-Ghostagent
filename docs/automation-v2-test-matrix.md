# Automation V2 — Test Matrix

> Audit date: 2026-04-27
> Status: COMPLETE — Phase 0

All test conversations must pass before V2 goes to production.

---

## Test Files

```
tests/automation-v2/appointments.test.ts
tests/automation-v2/ecommerce.test.ts
tests/automation-v2/language.test.ts
tests/automation-v2/reply-validator.test.ts
tests/automation-v2/state-machine.test.ts
```

---

## APPOINTMENTS TEST CASES

### APT-01: Greeting
```
User: "Hey"
Expected intent: greeting
Expected reply: "Hey 👋 how can I help?"
Expected state: idle
DB writes: none
```

### APT-02: Book with service name
```
User: "I want a haircut"
Expected intent: book_appointment
Expected state: awaiting_date_time
Expected reply: "Sure — what day and time would you like?"
DB writes: conversation_states upserted
```

### APT-03: Provide date/time (slot available)
```
State: awaiting_date_time (service=Haircut)
User: "Tomorrow at 11am"
Expected: resolve date from TIME_CONTEXT, check availability
Expected state: awaiting_customer_details
Expected reply: "{date} at 11:00 AM is available. Send your name and phone number to confirm."
DB writes: conversation_states updated
```

### APT-04: "Okay" when name/phone missing does NOT confirm
```
State: awaiting_customer_details
User: "Okay"
Expected: no name/phone extracted
Expected state: awaiting_customer_details (unchanged)
Expected reply: "Send your name and phone number to confirm."
DB writes: none
```

### APT-05: Provide name and phone → booking
```
State: awaiting_customer_details
User: "Ali, 78820707"
Expected: extract name=Ali, phone=78820707
Expected: insert into appointments table
Expected state: idle (cleared)
Expected reply: "Perfect — your Haircut is confirmed for {date} at 11:00 AM."
DB writes: appointments row inserted, conversation_states deleted
Verify: appointment visible via calendar query
```

### APT-06: Closed day
```
User: "Book a haircut on Sunday"
Setup: Sunday is_open=false in business_hours
Expected reply: "We're closed on Sunday."
Expected state: awaiting_date_time (keep flow, ask different day)
DB writes: none
```

### APT-07: Time outside hours
```
User: "Tomorrow at 11pm"
Setup: close_time=17:00
Expected: slot not available
Expected reply: contains "outside working hours" or suggests alternative
DB writes: none
```

### APT-08: Arabizi appointment
```
User: "Bde e5od maw3ed"
Expected intent: book_appointment
Expected reply: matches template (service/date prompt)
```

### APT-09: Arabic appointment
```
User: "بدي احجز موعد"
Expected intent: book_appointment
Expected reply: template in Arabic or auto-detected language
```

### APT-10: French appointment
```
User: "Je veux prendre rendez-vous"
Expected intent: book_appointment
Expected reply: template in French or auto-detected language
```

### APT-11: Spanish appointment
```
User: "Quiero una cita"
Expected intent: book_appointment
Expected reply: template in Spanish or auto-detected language
```

### APT-12: Business hours question
```
User: "What time do you open on Monday?"
Expected intent: business_hours
Expected: reads business_hours table
Expected reply: "We're open {summary}."
DB writes: none
```

### APT-13: Rejection during flow
```
State: awaiting_booking_confirmation
User: "No" / "la"
Expected state: idle (cleared)
Expected reply: "No problem. Let me know if you change your mind or need anything else."
DB writes: conversation_states deleted
```

### APT-14: Service question
```
User: "What services do you offer?"
Expected intent: service_question
Expected: reads services table (is_active=true)
Expected reply: "We offer: {serviceList}."
```

### APT-15: Price question
```
User: "How much is a haircut?"
Expected intent: price_question
Expected: reads services table for matching service
Expected reply: includes price from DB
```

### APT-16: Human handoff
```
User: "Can I talk to a manager?"
Expected intent: human_handoff
Expected: return null (no reply)
```

### APT-17: Full Arabizi flow (multi-message)
```
User 1: "Bde e5od maw3ed"  → awaiting_date_time
User 2: "Bukra se3a 11"     → awaiting_customer_details
User 3: "Ali, 78820707"     → insert → CONFIRMED
Verify: appointment in calendar
```

---

## E-COMMERCE TEST CASES

### ECOM-01: Greeting
```
User: "Hey"
Expected intent: greeting
Expected reply: "Hey 👋 what are you looking for?"
```

### ECOM-02: Product inquiry (in stock)
```
User: "Do you have the hoodie?"
Setup: inventory has "Essential Hoodie", stock=5
Expected intent: product_availability
Expected reply: contains product info + availability
```

### ECOM-03: Product with variant (in stock)
```
User: "Do you have hoodie medium black?"
Setup: inventory has "Essential Hoodie" with variant Medium/Black, stock=2
Expected: product matched, variant matched
Expected reply: "Yes, Medium / Black is available."
```

### ECOM-04: Product out of stock
```
User: "Do you have hoodie medium pink?"
Setup: stock_level=0 for that variant
Expected: product matched, out of stock
Expected reply: contains "sold out" + alternatives
```

### ECOM-05: Purchase intent → collect details
```
User: "I want the hoodie medium black"
Expected intent: purchase_intent
Expected state: awaiting_order_details
Expected reply: "Send your name, phone number, and delivery address to place the order."
```

### ECOM-06: "Okay" does NOT create order
```
State: awaiting_order_details
User: "Okay"
Expected: no details extracted
Expected state: awaiting_order_details (unchanged)
Expected reply: "Send your name, phone number, and delivery address to place the order."
```

### ECOM-07: Customer details → order created
```
State: awaiting_order_details
User: "Ali, 78820707, Hamra"
Expected: extract name=Ali, phone=78820707, address=Hamra
Expected: insert into orders table
Expected state: idle (cleared)
Expected reply: "Perfect — your order is confirmed."
DB writes: orders row inserted
Verify: order visible on orders page with correct name/phone/address/product
```

### ECOM-08: Unknown product → ask clarification
```
User: "Do you have the spaceship?"
Setup: no matching product in inventory
Expected reply: "Which product do you want?" or similar
```

### ECOM-09: Duplicate order prevention
```
State: existing Pending order for same chat within 30 min
User provides same item again
Expected: duplicate prevented, not double-ordered
```

### ECOM-10: Arabic product inquiry
```
User: "عندكن هودي ميديوم أسود؟"
Expected: product matched
Expected reply: in Arabic
```

### ECOM-11: Arabizi product inquiry
```
User: "Fi hoodie medium black?"
Expected: product matched
Expected reply: in Arabizi style
```

### ECOM-12: French product inquiry
```
User: "Vous avez le hoodie medium noir?"
Expected: product matched
Expected reply: in French
```

### ECOM-13: Order with unknown product blocked
```
User provides all details but item is "asdfgh"
Expected: order NOT created
Expected: bot asks for clarification
```

### ECOM-14: Order with blank name blocked
```
State: awaiting_order_details
User: "78820707, Hamra" (no name)
Expected: name still missing
Expected reply: asks for name
```

---

## LANGUAGE TEST CASES

### LANG-01: English detection
```
Input: "I want to book an appointment"
Expected: language=english
```

### LANG-02: Arabic detection
```
Input: "بدي احجز موعد"
Expected: language=arabic
```

### LANG-03: Arabizi detection
```
Input: "Bde e5od maw3ed"
Expected: language=arabizi
```

### LANG-04: French detection
```
Input: "Je veux prendre rendez-vous"
Expected: language=french
```

### LANG-05: Spanish detection
```
Input: "Quiero una cita"
Expected: language=spanish
```

### LANG-06: Mixed English+Arabizi
```
Input: "I want maw3ed tomorrow se3a 4"
Expected: language=mixed
```

### LANG-07: Fixed language mode
```
Dashboard setting: language="Arabic"
User writes in English
Expected: reply in Arabic
```

### LANG-08: Auto-detect mode
```
Dashboard setting: language="Auto-Detect"
User writes in French
Expected: reply in French
```

---

## REPLY VALIDATOR TEST CASES

### VAL-01: Block long paragraphs
```
Input: 300+ character multi-sentence reply
Expected: FAIL — too long
```

### VAL-02: Block false confirmation
```
Input: "Your appointment is confirmed!" (but no DB insert)
Context: isActuallyConfirmed=false
Expected: FAIL — confirmation without insert
```

### VAL-03: Block parroting
```
Customer message: "I want a haircut"
Bot reply: "I want a haircut, what times are available"
Expected: FAIL — parroting detected
```

### VAL-04: Block "I'm checking"
```
Input: "I'm checking that for you, please give me a moment"
Expected: FAIL — forbidden phrase
```

### VAL-05: Allow short template
```
Input: "Hey 👋 how can I help?"
Expected: PASS
```

### VAL-06: Allow confirmation with success flag
```
Input: "Perfect — your Haircut is confirmed for 2026-04-28 at 11:00 AM."
Context: isActuallyConfirmed=true
Expected: PASS
```

### VAL-07: Block fake data
```
Input: "We're open Monday to Friday, 9 AM to 5 PM" (but not from DB)
Context: no business hours truth provided
Expected: FAIL — invented hours
```

---

## STATE MACHINE TEST CASES

### SM-01: State persists across messages
```
Message 1: "I want a haircut" → state=awaiting_date_time
Message 2: "Tomorrow at 11am" → state=awaiting_customer_details
Verify: state.data.serviceName === "Haircut"
Verify: state.data.date === tomorrow's ISO date
```

### SM-02: State cleared on cancel
```
State: awaiting_customer_details
User: "cancel"
Verify: state deleted from conversation_states
```

### SM-03: State cleared on booking success
```
State: awaiting_booking_confirmation → user confirms
Verify: appointment inserted
Verify: state deleted from conversation_states
```

### SM-04: State drives response, not classifier
```
State: awaiting_customer_details
User: "Hello" (would classify as greeting)
Expected: treat as customer detail extraction attempt, not greeting
Expected: "Send your name and phone number to confirm." (not "Hey 👋 how can I help?")
```

### SM-05: Idle state allows classifier
```
State: idle
User: "Hey"
Expected: classifier runs → greeting → "Hey 👋 how can I help?"
```

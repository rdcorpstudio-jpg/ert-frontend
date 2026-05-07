# ERT System Overview (TH)

เอกสารนี้เป็นสรุประบบแบบอ่านเร็ว สำหรับกลับมาเข้าใจโปรเจกต์ได้ไวในครั้งถัดไป

## ระบบนี้คืออะไร

ERT เป็นระบบ ERP ภายในสำหรับจัดการงานออเดอร์แบบครบวงจร ตั้งแต่รับออเดอร์, ตรวจชำระเงิน, แพ็กสินค้า, จัดส่ง, ออกเอกสารบัญชี และดูรายงานยอดขาย

ภาพรวมการไหลงาน (Order Lifecycle):

1. ทีมขายสร้างออเดอร์
2. ทีมบัญชีตรวจสถานะการจ่าย (รวม COD)
3. ทีมแพ็กเตรียมสินค้าและอัปเดตการจัดส่ง
4. ใส่เลข Tracking และติดตามสถานะจนจบงาน
5. ฝั่งผู้จัดการดู Dashboard/Report และปรับตั้งค่าระบบ

## โครงสร้างโปรเจกต์

- Frontend: `/Users/nannam/Documents/Coding/ert-frontend`
- Backend: `/Users/nannam/Documents/Coding/ert-backend`

> หมายเหตุ: git repo หลักที่เปิดอยู่ตอนนี้คือฝั่ง frontend

## Tech Stack

### Frontend

- React + TypeScript + Vite
- React Router
- Axios (แนบ JWT อัตโนมัติ)
- Recharts (Dashboard/Report)

### Backend

- FastAPI
- SQLAlchemy + Alembic
- MySQL
- JWT auth + Role-based access control

### Integration ที่สำคัญ

- Google Drive: เก็บไฟล์แนบที่เกี่ยวกับออเดอร์
- LINE Messaging/LINE Config: แจ้งเตือนตามการตั้งค่า
- Excel export: ส่งออกรายงาน/รายการออเดอร์

## บทบาทผู้ใช้ (Role)

- `sale`: สร้างและติดตามออเดอร์ฝั่งขาย
- `account`: ตรวจสถานะการชำระเงิน/งานบัญชี/Invoice
- `pack`: งานเตรียมสินค้าและจัดส่ง
- `manager`: สิทธิ์ดูภาพรวม, ตั้งค่าระบบ, จัดการข้อมูลสำคัญ

## ฟีเจอร์หลักที่มีในระบบ

- สร้างออเดอร์ (สินค้า, ของแถม, ข้อมูลลูกค้า, วิธีชำระ, ไฟล์แนบ)
- รายการออเดอร์ + filter + อัปเดตสถานะ
- Packing board / Tracking number workflow
- COD verification
- Invoice upload และจัดการเลข Invoice
- Dashboard และ Sale Summary
- Manager tools (จัดการสินค้า/หมวด/แอดมินบางส่วน)

## Domain Model (ภาพจำแบบย่อ)

Entity สำคัญที่ควรรู้:

- User / Role
- Order
- OrderPayment
- OrderItem
- Product
- Freebie
- OrderFile
- OrderAlert
- OrderLog

## API ภาพรวม (Backend)

Router หลัก:

- `/auth` : login / register / auth management
- `/orders` : แกนหลักของระบบออเดอร์และรายงาน
- `/products` : จัดการสินค้าและข้อมูลที่เกี่ยวข้อง
- `/line-config` : ตั้งค่าการแจ้งเตือน LINE

## จุดเริ่มอ่านโค้ด (แนะนำ)

ถ้าจะทำความเข้าใจเร็ว ให้เริ่มตามลำดับนี้:

1. Frontend route map และหน้าเมนูหลัก
2. API service layer ฝั่ง frontend
3. Backend `main.py` และ router ของ `orders`
4. SQLAlchemy models ของ order/payment/item
5. Dashboard/report query และ export flow

## คำศัพท์สถานะงานที่ควรรู้

สถานะอาจต่างกันบางจุดตาม role/page แต่แกนหลักคือ:

- Pending / Checked / Packing / Shipped / Success
- รวมสถานะเฉพาะทาง เช่น Fail/Return/COD processing (ขึ้นกับ flow หน้าที่ใช้งาน)

## จุดที่ควรระวังเมื่อกลับมาพัฒนาต่อ

- ตรวจ env ให้ครบก่อนรัน (API URL, DB, JWT secret, service account)
- ฝั่ง auth ใช้ token ใน localStorage (ควรคุม expiry/refresh และ logout flow ให้ดี)
- งานอัปโหลดไฟล์และสถานะออเดอร์มีผลข้ามหลาย role ควรทดสอบ end-to-end
- ก่อนแก้รายงาน ให้เทียบ logic ระหว่าง frontend filters กับ backend query

## Checklist สำหรับ Onboarding รอบหน้า

- [ ] รัน frontend และ backend ได้ครบ
- [ ] login ได้ทุก role สำคัญ (อย่างน้อย sale/account/manager)
- [ ] สร้างออเดอร์ทดสอบ 1 รายการจนถึงขั้นจัดส่ง
- [ ] ทดสอบ dashboard และ export อย่างน้อย 1 flow
- [ ] ยืนยัน integration สำคัญ (Drive/LINE) ใน environment ที่ใช้งานจริง

---

หากเอกสารนี้เริ่มยาวขึ้น แนะนำแยกต่อเป็น:

- `docs/architecture.md` (ภาพรวมเชิงเทคนิค)
- `docs/roles-and-workflows.md` (flow ราย role)
- `docs/runbook.md` (ขั้นตอน run/ops/debug รายวัน)

Çalışan, Proje ve Otomatik Aktivite Takip Platformu
Teknik ve Fonksiyonel Gereksinim Dokümanı
1. Proje Özeti
Bu projenin amacı; şirketlerin çalışanlarını, projelerini, görevlerini, çalışma sürelerini
ve bilgisayar üzerindeki iş aktivitelerini tek bir platform üzerinden takip edebilmesini
sağlayan merkezi bir çalışma yönetim sistemi geliştirmektir.
Mevcut durumda müşterinin kullandığı sistemler farklı amaçlara hizmet etmektedir:
 Kolay İK: Çalışan/personel yönetimi
 Clockify: Çalışma süresi ve time tracking
 ClickUp: İş/görev atama ve görev takibi
 AutoCAD: Teknik çizim/proje çalışmaları
Temel problem, bu sistemlerin birbirinden bağımsız olması ve özellikle çalışma
sürelerinin büyük ölçüde çalışan tarafından manuel olarak girilmesidir.
Örneğin çalışan:
"Bu projede 6 saat çalıştım."
diyebilir.
Ancak yönetici şu soruların cevabını görememektedir:
 Gerçekten 6 saat çalıştı mı?
 Bu 6 saatin ne kadarı AutoCAD'de geçti?
 Hangi proje/dosya üzerinde çalıştı?
 Hangi görev için çalıştı?
 Gün içerisinde başka hangi uygulamaları kullandı?
 Atanan iş için tahmini süre ile gerçek süre arasında ne kadar fark var?
 Çalışanın girdiği süre ile bilgisayardan ölçülen aktivite arasında tutarsızlık var
mı?
Yeni platform bu problemi çözmelidir.
2. Ürünün Temel Amacı
Platformun temel amacı:
Çalışanın hangi projede, hangi görev üzerinde, ne kadar süre ve hangi uygulamalarla
çalıştığını mümkün olduğunca otomatik olarak ölçmek; bu veriyi proje/görev
yönetimiyle birleştirmek ve yöneticinin tek panelden takip edebilmesini sağlamak.
Sistem üç ana parçadan oluşacaktır:
A. Web Application
Yönetici ve çalışanların kullandığı merkezi web panel.
B. Desktop Agent
Çalışanın bilgisayarında çalışan ve aktivite verilerini toplayan masaüstü uygulaması.
C. Backend / API
Web uygulaması ile desktop agent arasındaki merkezi veri katmanı.
3. Genel Sistem Mimarisi
Temel mimari:
┌──────────────────────┐
│ WEB PANEL │
│ │
│ Admin / Manager │
│ Employee │
└──────────┬───────────┘
│
API
│
┌──────────▼───────────┐
│ BACKEND │
│ │
│ Auth │
│ Employees │
│ Projects │
│ Tasks │
│ Time Tracking │
│ Activity Tracking │
│ Reports │
│ Integrations │
└───────┬───────┬──────┘
│ │
Database │
│ │
│ │
┌─────────────▼─┐ ┌─▼────────────────┐
│ PostgreSQL │ │ Desktop Agent │
│ │ │ │
│ Employees │ │ Active App │
│ Projects │ │ Idle Time │
│ Tasks │ │ AutoCAD │
│ Activities │ │ Computer Events │
│ Time Logs │ │ │
└───────────────┘ └──────────────────┘
4. Kullanıcı Rolleri
Sistemde minimum üç rol bulunmalıdır.
4.1. Super Admin
Tüm sistem üzerinde yetkilidir.
Yetkileri:
 Şirket oluşturma
 Şirket yönetme
 Kullanıcı yönetme
 Sistem ayarları
 Entegrasyon yönetimi
 Sistem loglarını görüntüleme
4.2. Manager / Yönetici
Kendi şirketindeki çalışanları ve projeleri yönetebilir.
Yetkileri:
 Çalışan görüntüleme
 Proje oluşturma
 Görev oluşturma
 Görev atama
 Görev durumlarını takip etme
 Çalışma sürelerini görüntüleme
 Aktivite raporlarını görüntüleme
 Proje bazlı rapor alma
 Çalışan bazlı rapor alma
4.3. Employee / Çalışan
Kendi görevlerini ve kendi çalışma verilerini görebilir.
Yetkileri:
 Kendisine atanmış görevleri görüntüleme
 Görev durumunu güncelleme
 Manuel time entry girme
 Kendi çalışma raporlarını görüntüleme
 Kendi aktivitesini görüntüleme
Çalışan başka çalışanların aktivite verilerini göremez.
5. Şirket Yönetimi
Sistem multi-tenant olarak tasarlanmalıdır.
Her şirketin kendi:
 çalışanları
 projeleri
 görevleri
 aktiviteleri
 raporları
 ayarları
bulunmalıdır.
Bir şirketin verisi başka şirket tarafından kesinlikle görülememelidir.
Backend seviyesinde her ana tabloda gerekli tenant/company ilişkisinin tutulması ve
sorgularda tenant izolasyonunun sağlanması gerekmektedir.
6. Çalışan Yönetimi
Çalışan kaydı minimum olarak aşağıdaki bilgileri içermelidir:
Employee
-----------------
id
company_id
first_name
last_name
email
phone
department_id
position
manager_id
status
hire_date
created_at
updated_at
Çalışan durumları:
 Active
 Inactive
 Suspended
Çalışanın sisteme giriş yapabilmesi için kullanıcı hesabı ile employee kaydı
ilişkilendirilmelidir.
7. Departman Yönetimi
Departmanlar:
Department
-----------------
id
company_id
name
manager_id
created_at
updated_at
Örnek:
 Elektrik
 Mimari
 Mekanik
 Yazılım
 İnsan Kaynakları
 Proje Yönetimi
8. Proje Yönetimi
Yönetici proje oluşturabilir.
Proje:
Project
-----------------
id
company_id
name
code
description
client_name
status
start_date
end_date
estimated_hours
created_by
created_at
updated_at
Proje durumları:
 Planned
 Active
 On Hold
 Completed
 Archived
Örnek:
Proje:
ABC AVM Elektrik Projesi
Müşteri:
ABC İnşaat
Tahmini toplam:
350 saat
Durum:
Active
9. Görev Yönetimi
Her proje içerisinde birden fazla görev bulunabilir.
Örneğin:
Proje
└── ABC AVM Elektrik Projesi
├── A Blok Elektrik Çizimi
├── B Blok Elektrik Çizimi
├── Kat Planlarının Hazırlanması
├── Revizyonların Yapılması
└── Son Kontrol
Task modeli:
Task
-----------------
id
project_id
parent_task_id
title
description
assigned_to
created_by
status
priority
estimated_minutes
due_date
created_at
updated_at
completed_at
Task status:
 TODO
 IN_PROGRESS
 BLOCKED
 REVIEW
 COMPLETED
 CANCELLED
Priority:
 LOW
 MEDIUM
 HIGH
 URGENT
10. Görev Atama
Yönetici bir görevi bir veya birden fazla çalışana atayabilir.
Örnek:
Task:
A Blok Elektrik Çizimi
Project:
ABC AVM
Assigned:
Mehmet Yılmaz
Estimated:
6 hours
Deadline:
02.09.2026
Görev ekranında:
 Atanan çalışan
 Tahmini süre
 Harcanan süre
 Son aktivite
 Durum
 Deadline
gösterilmelidir.
11. Time Tracking
Sistemde iki farklı süre tutulmalıdır.
11.1. Manuel Time Entry
Çalışanın kendisinin girdiği süre.
Örnek:
Employee:
Mehmet
Project:
ABC AVM
Task:
A Blok Elektrik Çizimi
Start:
09:00
End:
12:00
Duration:
3h
11.2. Automated Activity Time
Desktop Agent tarafından ölçülen aktivite.
Örneğin:
09:02 - 10:31
AutoCAD
ABC_A_Block.dwg
10:31 - 10:46
Chrome
10:46 - 12:02
AutoCAD
ABC_A_Block.dwg
Bu iki veri birbirinden kesinlikle ayrılmalıdır.
12. Desktop Agent
Desktop Agent sistemin en önemli bileşenlerinden biridir.
Windows üzerinde çalışan bir uygulama olması MVP için yeterlidir.
Agent bilgisayar üzerinde çalışırken aşağıdaki bilgileri toplamalıdır:
Temel bilgiler
 Computer ID
 Employee ID
 Login/logout
 Agent start/stop
 Computer lock/unlock
 Idle duration
 Active window/application
 Application name
 Process name
 Window title
 Timestamp
Örnek:
Employee:
Mehmet
Computer:
MEHMET-PC
10:05
Active Application: AutoCAD
10:05
Window:
ABC_A_Block.dwg
10:32
Active Application:
Chrome
10:47
Active Application:
AutoCAD
13. Idle Detection
Uygulamanın açık olması tek başına çalışma anlamına gelmez.
Örneğin:
AutoCAD açık
↓
Kullanıcı bilgisayardan ayrıldı
↓
30 dakika mouse/keyboard hareketi yok
Bu durumda 30 dakika otomatik çalışma süresine eklenmemelidir.
Desktop Agent kullanıcı inactivity süresini tespit etmelidir.
Örnek:
09:00 - 10:00
Active
10:00 - 10:35
Idle
10:35 - 12:00
Active
Sonuç:
Active Time = 2h25m
Idle Time = 35m
Idle threshold şirket ayarlarından değiştirilebilir.
Örneğin default:
Idle threshold = 5 minutes
14. Application Tracking
Agent aktif uygulamayı tespit etmelidir.
Örneğin:
Application Duration
--------------------------------
AutoCAD 4h 12m
Chrome 46m
Excel 32m
Outlook 18m
Teams 24m
Other 15m
Idle 43m
Burada uygulamanın açık kalması ile aktif kullanım birbirinden ayrılmalıdır.
15. AutoCAD Entegrasyonu
Müşterinin kullanım senaryosunda AutoCAD kritik bir uygulamadır.
Amaç sadece:
"AutoCAD 4 saat açıktı."
demek değildir.
Mümkün olduğu ölçüde:
"Çalışan hangi AutoCAD dosyası üzerinde ne kadar süre çalıştı?"
bilgisinin elde edilmesi amaçlanmaktadır.
Örnek:
Employee:
Mehmet
Application:
AutoCAD
File:
ABC_A_Block.dwg
Active Time:
2h 17m
Başka dosya:
ABC_B_Block.dwg
46m
16. AutoCAD → Proje Eşleştirme
AutoCAD dosyasının proje ile ilişkilendirilmesi gerekmektedir.
Örneğin:
ABC_A_Block.dwg
↓
ABC AVM Projesi
↓
A Blok Elektrik Çizimi
Bu eşleştirme iki şekilde yapılabilir.
Yöntem 1 — Manuel Mapping
Yönetici:
ABC_A_Block.dwg
→ ABC AVM
şeklinde eşleştirir.
Yöntem 2 — Otomatik Mapping
Dosya adı, klasör yapısı veya başka metadata üzerinden sistem otomatik eşleştirme
yapabilir.
İlk MVP'de manuel mapping yeterlidir.
17. Aktivite Veri Modeli
Örnek:
Activity
-------------------------
id
company_id
employee_id
computer_id
timestamp_start
timestamp_end
duration_seconds
application_name
process_name
window_title
file_name
project_id
task_id
activity_type
created_at
Activity type:
 APPLICATION
 IDLE
 COMPUTER_LOCK
 COMPUTER_UNLOCK
 SYSTEM_START
 SYSTEM_STOP
18. Activity Aggregation
Desktop Agent'ın her saniye backend'e request atması önerilmemektedir.
Bunun yerine agent lokal olarak activity eventlerini toplamalı ve belirli aralıklarla
backend'e göndermelidir.
Örneğin:
09:00 - AutoCAD - ABC_A.dwg
09:01 - AutoCAD - ABC_A.dwg
09:02 - AutoCAD - ABC_A.dwg
...
bunların her birini ayrı API request olarak göndermek yerine:
{
"employee_id": "123",
"computer_id": "PC-001",
"activities": [
{
"start": "09:00",
"end": "09:42",
"application": "AutoCAD",
"file": "ABC_A.dwg"
}
]
}
şeklinde batch gönderilmesi daha doğru olacaktır.
19. Offline Çalışma
Desktop Agent internet bağlantısı kesildiğinde çalışmaya devam etmelidir.
Örneğin:
09:00
Internet var
09:30
Internet kesildi
09:30 - 11:00
Activity locally stored
11:00
Internet geldi
11:01
Agent accumulated activities → API
Bu nedenle agent üzerinde lokal bir queue/storage mekanizması bulunmalıdır.
İnternet geldiğinde veriler backend'e gönderilir.
20. Dashboard
Yönetici dashboard'u sistemin ana ekranlarından biridir.
Dashboard'da:
Genel bilgiler
Employees: 42
Active Employees: 35
Today's Active Time:
271h 32m
Today's Idle Time:
38h 14m
Completed Tasks:
27
Overdue Tasks:
8
21. Çalışan Dashboard'u
Yönetici çalışanı seçtiğinde:
Mehmet Yılmaz
Today's Activity
-----------------------
Active:
7h 12m
Idle:
48m
Manual Entry:
8h
Activity-based:
7h 12m
Sonrasında:
Applications
AutoCAD 4h 32m
Chrome 1h 02m
Excel 48m
Outlook 21m
Other 29m
22. Çalışan Günlük Timeline
En önemli ekranlardan biri timeline olacaktır.
Örneğin:
08:47
Computer Login
09:02
AutoCAD
ABC_A_Block.dwg
10:31
Chrome
10:47
AutoCAD
ABC_A_Block.dwg
12:04
Idle
13:02
AutoCAD
ABC_B_Block.dwg
14:18
Excel
14:42
AutoCAD
ABC_B_Block.dwg
Bu ekran yöneticinin çalışanın gününü hızlıca anlamasını sağlamalıdır.
23. Proje Dashboard'u
Yönetici bir projeye girdiğinde:
ABC AVM ELEKTRİK PROJESİ
Estimated:
350h
Tracked:
287h
Remaining:
63h
Görevler:
Task Estimate Actual Status
------------------------------------------------------------
A Blok çizim 40h 38h Completed
B Blok çizim 45h 61h In Progress
C Blok çizim 35h 29h Completed
Revizyon 30h 42h In Progress
Bu sayede projenin planlanan süreyi aşıp aşmadığı görülebilir.
24. Manuel Süre vs Otomatik Aktivite
Sistemin önemli bir raporu:
Employee: Mehmet
Project: ABC AVM
Task: A Blok Çizim
Manual:
6h 00m
Automated:
5h 12m
Difference:
48m
Bu fark doğrudan "çalışmadı" anlamına gelmemelidir.
Sistem bunu:
Activity / Manual Time Difference
olarak göstermelidir.
Yönetici daha sonra inceleyebilir.
25. Tutarsızlık / Anomali Sistemi
İlerleyen versiyonlarda sistem otomatik olarak potansiyel tutarsızlıkları işaretleyebilir.
Örneğin:
⚠ Time Difference
Employee:
Mehmet
Manual:
8h 00m
Tracked Activity:
5h 34m
Difference:
2h 26m
Başka örnek:
⚠ Project Mismatch
Employee:
Ahmet
Task:
ABC AVM
Detected activity:
XYZ Project
Duration:
1h 42m
Bu kayıtlar yöneticinin incelemesine bırakılmalıdır.
Sistem otomatik olarak çalışanı suçlayan bir sonuç üretmemelidir.
26. Görev Bazlı Otomatik Süre
Bir aktivitenin proje/görevle ilişkilendirilmesi mümkün olduğunda:
AutoCAD
↓
ABC_A_Block.dwg
↓
ABC AVM Project
↓
A Blok Elektrik Çizimi
şeklinde ilişki kurulmalıdır.
Sonuç:
Task:
A Blok Elektrik Çizimi
Estimated:
6h
Tracked:
5h 17m
Status:
In Progress
27. Çalışan Verimlilik Skoru
Bu özellik MVP'de zorunlu değildir.
İlerleyen aşamada:
Estimated Task Duration
vs
Actual Active Time
vs
Completed Work
gibi verilerden performans analizi yapılabilir.
Ancak yalnızca uygulama kullanım süresinden:
"Bu çalışan %87 verimli."
gibi kesin bir sonuç çıkarılmamalıdır.
Sistem öncelikle objektif aktivite verisini göstermelidir.
28. Raporlama
Sistem minimum olarak şu raporları desteklemelidir:
Employee Report
 Çalışan
 Gün
 Aktif süre
 Idle süre
 Manuel süre
 Uygulama kullanımı
 Proje dağılımı
Project Report
 Proje
 Toplam süre
 Çalışan sayısı
 Tahmini süre
 Gerçekleşen süre
 Görev durumu
Task Report
 Görev
 Çalışan
 Tahmini süre
 Manuel süre
 Aktivite süresi
 Durum
 Deadline
Application Report
AutoCAD 428h
Chrome 102h
Excel 87h
Outlook 43h
29. Filtreleme
Dashboard ve raporların tamamında filtreleme olmalıdır.
Filtreler:
 Tarih
 Çalışan
 Departman
 Proje
 Görev
 Uygulama
 Aktivite tipi
 Durum
Örneğin:
"Son 7 günde Mehmet'in ABC AVM projesinde AutoCAD'de geçirdiği süreyi göster."
30. Entegrasyonlar
Sistem ilerleyen aşamada aşağıdaki sistemlerle entegre edilebilir:
Kolay İK
Aktarılabilecek bilgiler:
 Çalışanlar
 Departmanlar
 Pozisyonlar
 İzin bilgileri
 Çalışan durumları
Amaç:
Çalışan bilgisini iki sistemde ayrı ayrı oluşturmak zorunda kalmamak.
ClickUp
Aktarılabilecek bilgiler:
 Projects
 Tasks
 Assignees
 Task status
 Deadline
 Comments
 Estimated time
Örneğin ClickUp'ta:
Task created
↓
API
↓
Our Platform
veya platform içerisinde oluşturulan görev:
Our Platform
↓
ClickUp API
↓
ClickUp
şeklinde senkronize edilebilir.
Clockify
İlk aşamada Clockify'ın tamamen kaldırılması yerine mevcut verilerin sisteme
aktarılması düşünülebilir.
Örneğin:
Clockify Historical Data
↓
Import
↓
Our Platform
Ancak uzun vadede Clockify'ın yerini otomatik activity tracking sistemi almalıdır.
31. API Yapısı
Backend REST API veya tercih edilen API mimarisi üzerinden çalışabilir.
Örnek endpointler:
POST /auth/login
GET /employees
POST /employees
GET /employees/:id
GET /projects
POST /projects
GET /projects/:id
GET /tasks
POST /tasks
PATCH /tasks/:id
POST /time-entries
GET /time-entries
POST /activities/batch
GET /activities
GET /reports/employees
GET /reports/projects
GET /reports/tasks
Desktop Agent için:
POST /agent/register
POST /agent/heartbeat
POST /agent/activities/batch
POST /agent/status
32. Agent Authentication
Desktop Agent'ın backend'e bağlanması için her cihazın benzersiz bir:
device_id
olmalıdır.
Örnek:
Employee:
Mehmet
Device:
MEHMET-PC
Device ID:
a82f-21ca-...
Agent authentication için güvenli token mekanizması kullanılmalıdır.
Token kesinlikle source code içerisine hard-code edilmemelidir.
33. Heartbeat
Desktop Agent belirli aralıklarla backend'e heartbeat göndermelidir.
Örneğin:
POST /agent/heartbeat
Payload:
{
"device_id": "PC-001",
"agent_version": "1.0.4",
"timestamp": "2026-08-31T15:20:00"
}
Bu sayede yönetici:
Mehmet
Agent:
Online
Last seen:
15:20
gibi bilgi görebilir.
34. Database Ana Tablolar
Minimum database yapısı:
companies
users
employees
departments
projects
tasks
time_entries
activities
devices
applications
integrations
audit_logs
İlişkiler:
Company
│
├── Employees
│ │
│ └── Devices
│
├── Projects
│ │
│ └── Tasks
│
├── Time Entries
│
└── Activities
35. Audit Log
Sistem üzerinde önemli işlemler kayıt altına alınmalıdır.
Örneğin:
Manager:
Ahmet
Action:
Task reassigned
Old:
Mehmet
New:
Ali
Timestamp:
2026-08-31 14:42
Audit log tutulacak işlemler:
 Kullanıcı oluşturma
 Kullanıcı silme
 Görev atama
 Görev yeniden atama
 Proje oluşturma
 Time entry değiştirme
 Time entry silme
 Ayar değiştirme
 Entegrasyon değiştirme
36. Veri Güvenliği
Bu sistem çalışan bilgisayarlarından veri topladığı için güvenlik kritik konudur.
Minimum gereksinimler:
 HTTPS
 JWT/session güvenliği
 Role-based authorization
 Tenant isolation
 Şifrelerin hashlenmesi
 API rate limiting
 Audit logging
 Secure token storage
 Database backup
 Encryption at rest mümkünse uygulanmalı
Desktop Agent yalnızca gerekli verileri toplamalıdır.
İlk MVP'de ekran görüntüsü alma gibi özellikler zorunlu değildir.
37. Gizlilik Tasarımı
Sistem:
"Çalışanın bilgisayarını tamamen izleyen spyware"
mantığında tasarlanmamalıdır.
Amaç:
İş/proje çalışma aktivitesini ölçmek.
Bu nedenle:
 Gereksiz kişisel veri toplanmamalı
 Şifreler kesinlikle toplanmamalı
 Klavye tuşları kaydedilmemeli
 Keylogger yapılmamalı
 Gereksiz ekran görüntüsü alınmamalı
 Hassas uygulamalar için tracking exemption bulunabilmeli
Örneğin şirket isterse:
Excluded Applications
WhatsApp
Personal Browser
Password Manager
Banking Apps
gibi uygulamaları activity tracking dışında bırakabilir.
38. Çalışan Tarafı Agent UI
Agent tamamen görünmez bir uygulama olmak zorunda değildir.
System tray üzerinde çalışabilir.
Örneğin:
🟢 Working
Current:
AutoCAD
Project:
ABC AVM
Task:
A Blok Elektrik Çizimi
Today's active time:
5h 42m
Çalışan kendi aktivitesini görebilir.
39. Manuel Time Entry Düzenleme
Çalışan yanlış süre girdiyse düzenleyebilir.
Ancak geçmiş kayıtların değiştirilmesi audit log'a yazılmalıdır.
Örneğin:
Before:
8h
After:
7h 30m
Reason:
Forgot to stop timer
Yönetici isterse manuel değişiklikleri onaylamak zorunda olabilir.
40. Bildirimler
İlk MVP'de basit notification sistemi yeterlidir.
Örneğin:
Task deadline approaching
Task:
B Blok Çizimi
Deadline:
Tomorrow
Yönetici için:
Task overdue
Task:
Revizyon Çalışması
Employee:
Mehmet
Overdue:
2 days
41. Ana Yönetici Ekranları
MVP'de minimum şu sayfalar bulunmalıdır:
/login
/dashboard
/employees
/employees/:id
/projects
/projects/:id
/tasks
/tasks/:id
/activities
/reports
/settings
/integrations
42. Ana Çalışan Ekranları
/my-dashboard
/my-tasks
/my-time
/my-activity
/my-projects
43. Dashboard Örnek Akışı
Yönetici sisteme girer.
Dashboard
Karşısına:
42 Employees
35 Active
7 Offline
271h Active Time
38h Idle
27 Completed Tasks
8 Overdue Tasks
çıkar.
Yönetici:
Employees
→ Mehmet
seçer.
Sonra:
Mehmet
Active:
7h 12m
Idle:
48m
Manual:
8h
Applications:
AutoCAD 4h 32m
Chrome 1h 02m
Excel 48m
görür.
Daha sonra:
Projects
→ ABC AVM
seçer.
Burada:
A Blok Çizimi
Estimated: 6h
Actual: 5h 17m
Status: In Progress
görür.
Bu sistemin temel kullanım senaryosudur.
44. MVP Kapsamı
İlk versiyonda aşağıdaki özellikler kesinlikle bulunmalıdır.
Web
 Authentication
 Role management
 Company
 Employee
 Department
 Project
 Task
 Task assignment
 Task status
 Manual time entry
 Dashboard
 Employee detail
 Project detail
 Basic reports
Desktop Agent
 Windows support
 Device registration
 Active application detection
 Active window detection
 Idle detection
 Login/logout
 Agent heartbeat
 Local activity queue
 Batch API upload
AutoCAD
İlk versiyonda mümkün olan seviyede:
 AutoCAD detection
 Active document/file detection
 File duration tracking
 File → Project mapping
45. MVP Sonrası
V2:
 ClickUp integration
 Kolay İK integration
 Clockify import
 Advanced reports
 Automatic project matching
 Advanced anomaly detection
 Better AutoCAD integration
 Notifications
 Export to Excel/CSV
V3:
 AI reporting
 AI project analysis
 Employee workload analysis
 Estimated vs actual prediction
 Automatic task/project classification
 Productivity insights
 Management recommendations
46. AI Modülü İçin Gelecek Senaryolar
Sistem yeterli veri topladıktan sonra AI katmanı eklenebilir.
Örnek kullanıcı sorusu:
"Bu hafta hangi projeler planlanan sürenin üzerinde?"
AI:
B Projesi planlanan 60 saatin üzerinde.
Estimated:
60h
Tracked:
82h 14m
Main contributor:
Revizyon işleri
En fazla süre:
AutoCAD
En çok süre harcayan çalışan:
Mehmet
Başka soru:
"Mehmet bugün ne yaptı?"
AI:
Mehmet bugün toplam 7 saat 12 dakika aktifti.
4 saat 32 dakika AutoCAD,
48 dakika Excel,
1 saat 02 dakika Chrome kullandı.
En fazla süre ABC AVM projesindeki
A Blok Elektrik Çizimi görevinde geçti.
47. Önemli Teknik Prensip
Sistemde üç farklı kavram birbirinden ayrılmalıdır:
1. Manuel Time
Çalışanın beyan ettiği süre.
2. Activity Time
Bilgisayar üzerinden ölçülen aktif uygulama kullanımı.
3. Billable / Project Time
Şirketin gerçekten proje için harcanmış kabul ettiği süre.
Bunların aynı şey olduğu varsayılmamalıdır.
Örneğin:
Manual:
8h
Activity:
7h 14m
Project Allocated:
6h 48m
Bu üç veri ayrı tutulmalıdır.
48. Başarı Kriteri
Projenin başarılı olması için yönetici aşağıdaki soruların tamamına tek panelden
cevap verebilmelidir:
Bugün kim çalışıyor?
Kim hangi projede çalışıyor?
Hangi çalışan hangi göreve atanmış?
Bu görev ne kadar süredir devam ediyor?
Tahmini süre ne?
Gerçekleşen aktivite süresi ne?
Çalışan hangi uygulamaları kullanıyor?
AutoCAD'de hangi dosya üzerinde çalışıyor?
Hangi projeye ne kadar zaman harcanıyor?
Manuel girilen süre ile ölçülen aktivite arasında fark var mı?
Hangi işler gecikmiş?
Hangi projeler planlanan sürenin üzerine çıkıyor?
Hangi çalışanların iş yükü fazla?
Bu soruların cevapları farklı uygulamalara girilmeden tek platformdan alınabilmelidir.
49. İlk Geliştirme Sırası
Geliştirme aşağıdaki sırayla yapılmalıdır:
Sprint 1 — Backend Foundation
 Database
 Authentication
 Company
 Users
 Employees
 Departments
 RBAC
Sprint 2 — Project Management
 Projects
 Tasks
 Assignment
 Status
 Priority
 Deadline
Sprint 3 — Time Tracking
 Manual time entry
 Time reports
 Project time
 Employee time
Sprint 4 — Desktop Agent
 Windows agent
 Device registration
 Application tracking
 Idle tracking
 Heartbeat
 Local queue
Sprint 5 — Activity Dashboard
 Activity timeline
 Employee activity
 Application reports
 Project/activity relation
Sprint 6 — AutoCAD
 AutoCAD detection
 Active document detection
 DWG tracking
 Project mapping
Sprint 7 — Reports
 Employee report
 Project report
 Task report
 Manual vs activity comparison
Sprint 8 — Integrations
 ClickUp
 Kolay İK
 Clockify import
50. Sonuç
Bu proje basit bir time tracking uygulaması olarak ele alınmamalıdır.
Platformun temel yapısı:
EMPLOYEE
↓
PROJECT
↓
TASK
↓
TIME
↓
DESKTOP ACTIVITY
↓
APPLICATION
↓
AUTOCAD FILE
ilişkisini kurmalıdır.
Örneğin nihai veri akışı:
Mehmet
↓
ABC AVM Projesi
↓
A Blok Elektrik Çizimi
↓
AutoCAD
↓
ABC_A_Block.dwg
↓
5h 17m Active Activity
şeklinde takip edilebilmelidir.
Böylece sistem, yalnızca:
“Çalışan kaç saat girdi?”
sorusunu değil;
“Çalışan hangi işe, hangi projede, hangi uygulamayla, ne kadar zaman harcadı ve
verilen işin tahmini ile gerçekleşen süre arasında nasıl bir fark var?”
sorusunu cevaplayan merkezi bir Workforce & Project Management Platform haline
gelecektir.
# Parent Communication and Child Activity Reporting Platform for Daycare Centers

## Document Metadata

- **Document type:** Senior Project Proposal Document
- **Institution:** HiLCoE, School of Computer Science and Technology
- **Project:** Parent Communication and Child Activity Reporting Platform for Daycare Centers
- **Prepared by:** Arsema Alemayehu; Helina Fikru; Melat Hailu; Mistire Tilahun
- **Date:** July 2026

> **AI-readable edition:** Converted from the original DOCX. Word-only layout elements, the cover logo, page numbers, and the duplicated table of contents were removed. The proposal content, section structure, lists, tables, project timeline, and references are preserved.

---

# 1. INTRODUCTION/BACKGROUND

## 1.1 Background of the Project

Daycare centers provide supervision, care, early learning, and social development support for young children while their parents or guardians are at work or attending to other responsibilities. Because parents are not physically present during much of the day, clear and timely communication between the daycare center and the family is essential. Parents commonly need information about attendance, meals, sleeping periods, learning and play activities, mood, behavior, health observations, and any unusual incident involving their child. Daycare administrators and caregivers also need an organized way to maintain these records and communicate important announcements.

While existing solutions in the Ethiopian context primarily rely on general-purpose messaging applications or manual record-keeping, this project introduces a dedicated platform that is specifically designed for daycare center operations. Although these methods can provide basic information, they may result in incomplete reports, delayed updates, scattered records, repeated communication, and difficulty retrieving a child's previous activity history. The proposed solution is novel in the local context because it provides structured child activity reporting, role-based access control, centralized record management, and integrated parent–caregiver communication within a single, purpose-built platform. Unlike generic messaging tools, this platform organizes communication around individual children, maintains historical records, and supports accountability through systematic reporting.

As the project has been refined, five additional features have been included without changing the platform's main purpose. The centralized database will serve as the common data source for child profiles, parents or guardians, caregivers, attendance, reports, communication records, events, products, orders, and related system records. An AI-based Parent Guide will provide general, non-medical guidance such as age-appropriate activities, meal ideas, outfit and daycare-preparation suggestions, and other everyday recommendations based on relevant information provided by the parent and available daycare context. Biometric guardian verification will support safer child pickup by allowing an authorized adult parent or guardian to be verified at the daycare before check-out is completed. A small daycare e-commerce module will allow parents to order products supplied by the daycare, such as pencils, exercise books, coloring materials, napkins, diapers, and similar items. A simple events calendar will also provide one place for parents to view holidays, parent meetings, activity days, and other scheduled daycare events.

## 1.2 Project Motivation and Rationale

The proposed Parent Communication and Child Activity Reporting Platform for Daycare Center is motivated by the need for a structured, secure, and accessible communication channel between parents, caregivers, and daycare administrators. The project will focus on providing a centralized platform through which caregivers can record children's daily activities and parents can receive relevant reports, notices, and alerts. The platform is expected to support accountability, improve continuity of care, reduce dependence on fragmented paper-based communication, and help parents remain informed about their children throughout the daycare period. Unlike general-purpose messaging applications, the proposed platform is specifically designed for daycare centers and provides structured child activity reporting, role-based access for parents, caregivers, and administrators, centralized record management, attendance tracking, health and incident reporting, and secure communication within a single platform. This context-specific focus makes the proposed solution more suitable for daycare operations than ordinary communication tools. The project idea therefore combines a practical daycare communication need with an opportunity to apply software engineering principles to develop a useful information system. The proposed platform also supports digital transformation within daycare centers by replacing fragmented manual communication with centralized electronic reporting.

The added features are intended to strengthen this same objective rather than turn the project into a complete daycare enterprise system. The AI Parent Guide will extend parent support beyond simple reporting, biometric verification will strengthen the child-pickup process, the e-commerce module will make commonly required daycare supplies easier to obtain, and the events calendar will improve awareness of planned activities. All of these modules will use the same centralized database and role-based access structure so that the system remains organized and manageable.

# 2. STATEMENT OF THE PROBLEM

Effective communication between daycare centers and parents is important because parents depend on caregivers to provide information about their children while they are away. However, communication in some daycare centers may rely mainly on verbal updates during pickup, telephone calls, handwritten notebooks, paper forms, or general-purpose messaging applications. These methods are not specifically designed for organized child activity reporting and may make it difficult to provide complete, consistent, and timely information to every parent.

When information is communicated through different channels, records about attendance, meals, sleeping periods, learning and play activities, mood, behavior, health observations, and unusual incidents may become scattered or incomplete. Parents may receive only a short summary at the end of the day, while caregivers may spend additional time repeating the same information to different parents. Paper-based records may also be difficult to search, update, store, and retrieve when a previous activity report is needed.

Preliminary observations of daycare communication practices indicate that preparing manual reports can consume caregiver time and make historical child information difficult to retrieve when parents request previous attendance or activity records. The absence of a centralized and role-based platform can also make it difficult for daycare administrators to monitor whether daily reports have been completed, whether important announcements have reached parents, and whether communication records are properly maintained. Using ordinary messaging platforms may further mix personal and institutional communication and may not provide structured access to information related to a particular child.

The current process can also create other practical gaps that are closely related to parent-daycare communication. Parents may need simple guidance about suitable activities, meals, clothing, routines, or daycare preparation but may not have one reliable place to request general recommendations. Daycare staff may also need a stronger way to verify that the adult collecting a child is an authorized parent or guardian. In addition, parents may have to obtain frequently requested daycare supplies from separate shops even when the daycare already provides those items, and important events or parent meetings may be communicated through scattered messages that are easy to overlook. These gaps can be addressed in a limited and practical way through an AI Parent Guide, biometric guardian verification, an internal daycare store, and a simple events calendar integrated with the platform's central records.

Therefore, there is a need for a dedicated Parent Communication and Child Activity Reporting Platform for Daycare Center. The proposed platform will organize child-related information in one system and provide authorized parents, caregivers, and administrators with appropriate access to daily activity reports, announcements, messages, and important alerts. The absence of a dedicated platform creates inefficiencies in daycare operations, increases caregiver workload through repeated verbal reporting, and limits parents’ access to comprehensive information about their children’s daily experiences. This project addresses these challenges by providing a centralized digital solution that streamlines communication, improves record accessibility, and enhances the overall quality of parent–daycare interaction.

# 3. GENERAL AND SPECIFIC OBJECTIVES

## 3.1 General Objective

The general objective of this project is to design and develop a Parent Communication and Child Activity Reporting Platform that improves the recording, management, and exchange of child-related information between daycare centers and parents, while also supporting centralized data management, AI-assisted parent guidance, secure guardian verification, daycare product ordering, and simple event scheduling.

## 3.2 Specific Objectives

1.  To study the existing parent communication and child activity reporting practices used in daycare centers.

2.  To identify the functional and non-functional requirements of parents, caregivers, and daycare administrators.

3.  To design a centralized database for managing children, parents or guardians, caregivers, attendance, activity records, communication records, events, authorized guardians, products, orders, payments, and related system data.

4.  To develop a secure user authentication and role-based access mechanism for parents, caregivers, and administrators.

5.  To enable caregivers to record and share children’s attendance, meals, sleep, learning activities, play activities, behavior, health observations, and incidents.

6.  To enable parents to view authorized daily activity reports, receive announcements and alerts, and communicate with daycare staff.

7.  To provide daycare administrators with tools for managing users, children’s profiles, classes or groups, announcements, and reporting activities.

8.  To develop an AI-based Parent Guide that provides general age-appropriate activities, meal ideas, outfit and daycare-preparation suggestions, and other everyday recommendations without providing medical or psychological diagnosis.

9.  To integrate biometric verification for authorized adult parents or guardians during child pickup, with a controlled manual verification alternative when biometric verification cannot be completed.

10. To provide a daycare e-commerce module through which parents can browse daycare-supplied products, place orders, choose an available payment option, and view order status while administrators manage products, basic stock, prices, and orders.

11. To provide a simple events calendar through which daycare administrators can publish holidays, parent meetings, activity days, and other scheduled events for parents or guardians to view.

12. To test the proposed platform for functionality, usability, security, reliability, database integrity, AI response suitability, biometric verification, e-commerce transactions, and event-calendar operation.

# 4. SCOPE OF THE PROJECT AND LIMITATIONS

## 4.1 Scope of the Project

The scope of this project is defined by the functions that the proposed solution is expected to provide and by the boundaries within which the system will be developed and evaluated. The Parent Communication and Child Activity Reporting Platform will focus on improving the exchange and management of child-related information among daycare administrators, caregivers, and parents or guardians. It will not be designed as a complete daycare enterprise management system.

The main users included within the project scope are daycare administrators, caregivers or teachers, and registered parents or guardians. Each user will access only the functions and information permitted by the assigned role. The proposed system will cover the following major functionalities:

1. **User and access management:** Create and manage administrator, caregiver, and parent or guardian accounts; authenticate users; and apply role-based access control.

2. **Child profile management:** Register and update basic child information, link a child with authorized parents or guardians, record emergency contacts and relevant care instructions, and assign the child to a caregiver or group.

3. **Attendance management:** Record child check-in, check-out, absence, and attendance history.

4. **Daily activity reporting:** Allow caregivers to record meals and snacks, sleeping periods, learning activities, play activities, mood, behavior, and general observations for each child.

5. **Health and incident reporting:** Record health observations and unusual incidents and communicate important information to the authorized parent or guardian. The platform will support reporting only and will not provide medical diagnosis.

6. **Parent-daycare communication:** Provide structured messages, announcements, reminders, important alerts, and notification messages between the daycare center and parents or guardians. The system may also support sharing authorized activity photographs related to a child's daily activities.

7. **Report access and history:** Allow authorized users to view current and previous child activity reports, attendance records, communication records, and selected administrative summaries.

8. **Administrative monitoring:** Enable the daycare administrator to manage users, children, groups, announcements, and the completion of activity reports.

9. Centralized database and record management: Use a structured central database to store and relate child profiles, user accounts, attendance, daily reports, messages, events, authorized guardians, products, stock, orders, payments, and audit-related records. Access to the data will be controlled according to user roles.

10. AI Parent Guide: Provide parents or guardians with general guidance and recommendations related to age-appropriate activities, meal ideas, outfit choices, daycare preparation, routines, and other everyday parenting questions. The AI will use only appropriate available context and will not provide medical diagnosis, treatment, or professional psychological counseling.

11. Biometric guardian verification: Allow an authorized adult parent or guardian to be enrolled and verified at the daycare during child pickup. The biometric feature will be used as an additional identity-verification step before check-out is completed. The first version will not collect child biometrics, and a controlled manual verification procedure will remain available when needed.

12. Daycare e-commerce: Allow the daycare to list its own commonly required products, such as pencils, exercise books, coloring materials, napkins, diapers, uniforms, and similar supplies. Parents will be able to view products, add items to a cart, place an order, select Pay at Daycare or an available digital payment method, and follow the order status. Administrators will manage products, prices, basic stock, orders, and payment status. The module will not operate as a third-party marketplace or home-delivery service.

13. Simple events calendar: Allow administrators to add daycare events such as holidays, parent meetings, activity days, special programs, and closing dates. Parents or guardians will be able to view upcoming events in a simple calendar or event-list view.

## 4.2 Project Delimitation

The initial version of the platform will be developed and evaluated within the context of a selected daycare center and its authorized users. The project will concentrate on parent communication, child activity reporting, attendance, announcements, alerts, centralized record management, AI-based parent guidance, biometric guardian verification during pickup, a limited daycare e-commerce function, and a simple events calendar. Information will be entered by authorized daycare staff and made available only to users who are linked to the corresponding child or assigned an appropriate administrative role.

Functions such as payroll, employee recruitment, complete accounting, daycare fee collection, transportation management, live CCTV streaming, GPS tracking, automatic medical diagnosis, integration with government or hospital information systems, home-delivery logistics, third-party marketplace selling, advanced warehouse management, and biometric identification of children are outside the scope of this project. The e-commerce feature will include only the basic product, stock, ordering, and payment functions required for products supplied by the daycare. The AI feature will provide general informational guidance only and will not replace medical, nutritional, psychological, or other professional advice. These excluded functions may be considered as future extensions after the main platform has been implemented and evaluated.

## 4.3 Limitations of the Project

The following factors may limit the project or affect the extent to which its objectives are achieved:

- The availability and cooperation of daycare administrators, caregivers, and parents may affect the amount and quality of information collected during requirement elicitation and evaluation.

- The platform may depend on the availability of suitable devices, electric power, and internet or local network connectivity at the daycare center and in parents’ locations.

- The completeness and accuracy of daily activity reports will depend on caregivers entering information correctly and on time.

- Because of the academic project timeline and available resources, paid SMS services, government-system integration, specialized medical-system integration, and other large external services may not be implemented in the first version. The planned digital-payment option for the daycare store will depend on the availability of an approved payment-gateway account, internet connectivity, and the requirements of the selected payment provider. If live payment approval is delayed during development, the module can be developed and tested in a sandbox environment while Pay at Daycare remains available.

- Testing may be conducted with a limited number of users in a selected daycare center; therefore, findings from the initial evaluation may not represent every daycare center or every operating condition.

- The project handles sensitive information about children and may also process biometric information belonging to authorized adult guardians. Access to real records, photographs, health observations, contact information, or biometric data may be restricted by consent, privacy requirements, and the policies of the participating daycare center. Sample or anonymized data will be used where appropriate.

- The AI Parent Guide will depend on the quality of the information provided to it and, if a cloud-based AI service is used, on internet availability and the external service. Its suggestions may not always be perfect; therefore, it will be limited to general guidance and will clearly avoid diagnosis or treatment decisions.

- Biometric verification may be affected by device availability, enrollment quality, damaged fingerprints, camera or sensor limitations, or temporary hardware failure. For this reason, biometric verification will be treated as an additional safety control rather than the only possible method for releasing a child to an authorized guardian.

# 5. METHODOLOGY / APPROACH

## 5.1 Development Approach

The project will follow an Object-Oriented Software Engineering approach supported by iterative and incremental development. The object-oriented approach will be used to identify actors, use cases, objects, classes, relationships, and system behavior. The iterative approach will allow the team to develop the platform in manageable increments, obtain feedback from intended users, and improve the solution during successive development cycles.

The work will pass through problem study, requirements elicitation, requirements analysis, system and object design, implementation, testing, user evaluation, deployment preparation, and documentation. Outputs from each phase will be reviewed before the team proceeds to the next phase, while necessary revisions may be made when new information or advisor feedback is received. The core communication and reporting functions will be implemented first, followed by the AI Parent Guide, biometric guardian verification, daycare e-commerce, and events calendar so that the additional features do not prevent completion of the basic system.

Unified Modeling Language (UML) diagrams, including Use Case, Activity, Sequence, Class, and Deployment diagrams, will be prepared during the analysis and design phases to model the structure and behavior of the proposed system.

## 5.2 Data Collection Methods

Requirement information will be collected from relevant daycare stakeholders and existing work practices. The team plans to use the following methods:

- **Interview:** Semi-structured interviews will be conducted with daycare administrators and caregivers to understand current communication procedures, reporting responsibilities, common problems, required information, and expected system functions.

- **Questionnaire:** A questionnaire may be distributed to selected parents or guardians to identify the types of information they need, their communication difficulties, preferred notifications, expectations for AI-based guidance, commonly needed daycare supplies, event-information needs, and usability expectations.

- **Observation:** The team will observe relevant daycare processes such as child arrival, attendance recording, preparation of daily reports, parent pickup communication, verification of authorized guardians, announcement delivery, event communication, and the handling of commonly requested child supplies.

- **Document review:** Existing attendance sheets, child registration forms, daily activity sheets, incident forms, announcements, and other relevant records will be reviewed when permission is provided.

- **Related-system and literature review:** Published works and existing daycare communication or child reporting solutions will be reviewed to identify useful practices, limitations, and opportunities for improvement without copying an existing solution.

## 5.3 Project Phases, Techniques and Tools

The guideline does not prescribe a specific programming technology. Therefore, the tools listed below are proposed tools and may be refined after requirements analysis and advisor approval.

| **Project Phase**              | **Methods / Techniques**                                                                                                                                                                                                                   | **Proposed Tools and Outputs**                                                                                                                                                                                                                      |
|--------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Planning and problem study** | Define the problem, stakeholders, objectives, scope, risks, and task breakdown.                                                                                                                                                            | Microsoft Word; planning notes; advisor review.                                                                                                                                                                                                     |
| **Requirements elicitation**   | Interviews, questionnaires, observation, and review of existing forms and records.                                                                                                                                                         | Interview guide; questionnaire or Google Forms; observation checklist; Microsoft Word/Excel.                                                                                                                                                        |
| **Requirements analysis**      | Classify functional and non-functional requirements; identify actors, use cases, data, rules, and process flows.                                                                                                                           | Use-case descriptions; UML use-case and activity diagrams; draw.io or StarUML.                                                                                                                                                                      |
| **System and object design**   | Design software architecture, subsystems, centralized database structure, classes, interfaces, navigation, screen prototypes, AI integration points, biometric-verification flow, e-commerce flow, and events-calendar structure.          | Class, sequence, and architecture diagrams; ER diagram; Figma; draw.io/StarUML; database schema; API and integration designs.                                                                                                                       |
| **Implementation**             | Develop the user interface, application logic, centralized database, authentication, reporting, communication, AI Parent Guide, biometric guardian verification, daycare e-commerce, and events-calendar modules in manageable increments. | Proposed stack: React, Node.js/Express, and PostgreSQL; Visual Studio Code; Git and GitHub; suitable AI API/service; biometric device or platform interface; Chapa or another approved Ethiopian payment gateway for the digital-payment component. |
| **Testing and evaluation**     | Prepare test cases; perform unit, integration, system, usability, security, database-integrity, AI-response, biometric-verification, e-commerce/payment, event-calendar, and user-acceptance testing; record expected and actual results.  | Browser developer tools; Postman; test-case forms; automated test tools where appropriate; payment sandbox tools; device testing for biometric verification.                                                                                        |
| **Deployment preparation**     | Configure the application environment, create authorized accounts, prepare database backup procedures, configure required integration credentials, and conduct a pilot demonstration of both the core and added modules.                   | Secure hosting or local deployment environment; PostgreSQL backup tools; deployment checklist; test/live integration configuration as available.                                                                                                    |
| **Documentation and control**  | Prepare deliverable documents, user instructions, meeting notes, milestone reports, and controlled versions of source code.                                                                                                                | Microsoft Word; Git/GitHub; shared project folder; milestone and review checklists.                                                                                                                                                                 |

## 5.4 Testing and Evaluation Approach

Testing will be conducted throughout development rather than only after implementation. Unit testing will check individual functions or components; integration testing will examine communication among modules; and system testing will verify the complete platform against the documented functional and non-functional requirements. Test cases will record the test condition, input, expected result, actual result, and remarks.

Usability and user-acceptance evaluation will involve representative daycare administrators, caregivers, and parents or guardians where access is permitted. Security checks will focus on authentication, role-based authorization, protection of child records, input validation, session handling, and prevention of unauthorized access. Feedback and defects identified during testing will be documented, prioritized, corrected, and tested again.

The added modules will receive targeted testing. The centralized database will be checked for correct relationships, backup and recovery, and protection against unauthorized access. The AI Parent Guide will be tested with normal and unusual parent questions to check that suggestions remain relevant, understandable, and within the intended non-medical scope. Biometric testing will cover successful verification, failed verification, unauthorized-guardian attempts, and the manual fallback procedure. The e-commerce module will be tested for product availability, cart totals, stock updates, order status, duplicate-payment prevention, and confirmation of digital-payment results before an order is marked as paid. The events calendar will be tested for correct event creation, date display, editing, and parent visibility.

# 6. SIGNIFICANCE AND BENEFICIARIES

The proposed Parent Communication and Child Activity Reporting Platform has practical value because it is intended to organize the information exchanged between a daycare center and parents or guardians. Instead of depending only on verbal explanations, paper records, telephone calls, or scattered messages, the platform will provide one structured place for recording and accessing attendance, meals, sleeping periods, learning and play activities, behavior observations, health notes, incidents, announcements, and important alerts.

The expected outcome of the project will support timely, consistent, and traceable communication. It will help authorized users review current and previous records, reduce the possibility of important information being forgotten or misplaced, and improve the continuity of communication between the daycare center and the family. The platform will also provide a practical software solution that can be evaluated in a selected daycare-center context and improved in later versions.

The additional modules are expected to make the platform more useful in everyday daycare situations while remaining within a manageable academic scope. Parents will have access to general AI-assisted recommendations, the daycare will have an additional identity check for authorized pickup, commonly required supplies can be ordered through the same system, and important dates can be viewed in a simple calendar. Because these features share one centralized database, they can work together without requiring parents to move between several unrelated applications.

**The main beneficiaries and anticipated benefits are presented below:**

- **Parents and guardians:** They will be able to receive organized child activity reports, view authorized report history, obtain announcements and important alerts, communicate with daycare staff, ask the AI Parent Guide for general everyday recommendations, order products supplied by the daycare, and view upcoming daycare events.

- **Caregivers and teachers:** They will have a consistent format for recording daily activities and observations. This can reduce repeated verbal reporting, improve record completeness, and make earlier information easier to retrieve.

- **Daycare administrators:** They will be able to manage authorized users and child profiles, publish announcements and events, monitor the completion of activity reports, manage daycare-store products and orders, review guardian-verification records, and maintain centralized communication and reporting records.

- **Children:** Children will benefit indirectly from better coordination between families and caregivers, more complete care information, faster communication when an important observation or incident occurs, and an additional verification step intended to support safer authorized pickup.

- **The participating daycare center:** The center can use the platform to standardize communication, strengthen accountability, improve service organization, manage a small internal product store, publish events in an organized way, and demonstrate a more systematic approach to parent communication and child pickup.

- **The student project team and future developers:** The project will allow the team to apply computer science and software engineering knowledge to a real organizational problem while gaining practical experience with database design, AI integration, biometric verification, e-commerce/payment integration, security, testing, and system documentation. The documented work may also provide a basis for future extensions.

# 7. TASK BREAKDOWN AND FEASIBILITY ANALYSIS

## 7.1 Task Breakdown

The project work will be divided into related tasks, and each group of tasks will produce a clear outcome that contributes to the completion of the proposed system.

| **Task**                                    | **Main Activities**                                                                                                                                                                                                                             | **Expected Outcome**                                                                                                                    |
|---------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| Project initiation and proposal preparation | Clarify the problem, identify stakeholders, define the title, objectives, scope, limitations, methodology, and initial plan.                                                                                                                    | Approved project proposal and a common understanding of the work to be performed.                                                       |
| Study of the current practice               | Observe existing parent communication and child-reporting activities and review available forms, records, and communication procedures.                                                                                                         | Description of the current situation, its limitations, and the context of the proposed solution.                                        |
| Requirements elicitation                    | Prepare and conduct interviews, questionnaires, observation, and document review with permitted daycare stakeholders.                                                                                                                           | Collected stakeholder needs, business rules, reporting needs, and supporting data-collection records.                                   |
| Requirements analysis and specification     | Classify functional and non-functional requirements; identify actors, use cases, data items, processes, access rules, and system constraints.                                                                                                   | Software/System Requirements Analysis and Specification Document and analysis-level models.                                             |
| System and object design                    | Design the software architecture, subsystem interaction, centralized database, classes, interfaces, navigation paths, user-interface prototypes, AI interaction flow, biometric pickup flow, e-commerce flow, and events calendar.              | System Design Document, Object Design Document, diagrams, database design, integration designs, and interface mock-ups.                 |
| Incremental implementation                  | Develop authentication, user and child management, attendance, daily activity reporting, communication, alerts, reporting, and the centralized database in manageable increments.                                                               | A working integrated prototype containing the core Parent Communication and Child Activity Reporting functions.                         |
| Additional feature integration              | Integrate the AI Parent Guide, biometric guardian verification, daycare e-commerce with basic stock and payment handling, and the simple events calendar with the core system and centralized database.                                         | Working added modules connected to the main platform without removing or replacing the original communication and reporting functions.  |
| Testing and correction                      | Prepare test cases and perform unit, integration, system, usability, security, database-integrity, AI-response, biometric-verification, e-commerce/payment, event-calendar, and user-acceptance testing; record and correct identified defects. | Testing specifications, test results, corrected software, and evidence that both the original and added requirements have been checked. |
| Pilot evaluation and deployment preparation | Demonstrate the platform to representative authorized users, collect feedback, prepare accounts, backups, installation steps, integration settings, biometric verification procedures, and operational guidance.                                | Evaluation feedback, deployment checklist, backup procedure, integration checklist, and a pilot-ready version of the system.            |
| Documentation and project control           | Prepare milestone reports, meeting notes, source-code versions, implementation report, user manual, presentation materials, and the final project report.                                                                                       | Controlled project records and the required senior-project deliverable documents.                                                       |

## 7.2 Feasibility Analysis

The feasibility of the project is considered in relation to its practical use, the technical and other resources required, and the available academic project time.

**Practical and operational feasibility:** The proposed platform addresses a recognizable daycare communication and reporting need and can be introduced initially in a selected daycare center. Its original functions follow activities already performed by administrators, caregivers, and parents, but organize them in digital form. The added AI Parent Guide, biometric guardian verification, daycare e-commerce, and events calendar are limited to practical tasks that can be demonstrated without turning the project into a full enterprise system. Role-based interfaces and simple workflows are expected to make the system understandable to intended users. A pilot demonstration, basic user guidance, and feedback from representative users will be used to check whether the proposed procedures are practical in the selected context.

**Technical and resource feasibility:** As fourth-year Computer Science students at HiLCoE, the team will apply knowledge and skills developed during the undergraduate program in software engineering, databases, programming, user-interface design, testing, and project documentation. The proposed system can be developed using available personal computers, internet access, and commonly available development and modelling tools. The methodology section proposes React, Node.js/Express, PostgreSQL, Visual Studio Code, Git/GitHub, Figma, and draw.io or StarUML. The AI Parent Guide can be integrated through a suitable AI service or API, biometric guardian verification can use a compatible biometric device or platform interface, and the daycare store can use an approved Ethiopian payment gateway such as Chapa for supported digital payments while also retaining Pay at Daycare. Most of the software tools can be used without major license cost, although live external services may require accounts, approval, connectivity, or limited service charges.

**Resource and cost feasibility:** The main resources required are team members' time, computers, internet connectivity, transportation for data collection, printing, storage or backup facilities, an optional hosting environment, and access to suitable integration services or devices. The project will reduce resource requirements by using existing equipment and free or open-source tools where possible. The biometric feature will be limited to authorized adult guardian verification rather than a large biometric-management system, the e-commerce module will provide only basic daycare product and order functions, and the events calendar will remain simple. Possible costs for a biometric device, hosting, AI API usage, or live digital-payment service will be kept at a small pilot or demonstration level.

**Time feasibility:** The project can be completed within the senior-project period by dividing the work into successive phases and developing the software incrementally. Requirement collection and analysis will be completed before detailed design and implementation, while documentation, version control, advisor feedback, and testing will continue throughout the work. The original communication, child-management, attendance, and reporting functions will be developed first. The AI Parent Guide, biometric verification, e-commerce, and events calendar will then be added as separate, limited modules and integrated with the central database. Tasks can be assigned among the four team members according to responsibility, but major outputs will be reviewed by the whole team. A detailed Gantt or PERT schedule will be prepared in the project schedule section to allocate time to each task and monitor progress.

**Organizational and data feasibility:** The project will require permission and cooperation from the selected daycare center and voluntary participation from relevant stakeholders. Access to child-related information may be restricted; therefore, the team will use authorized, limited, anonymized, or test data where appropriate. The centralized database will use role-based access, password protection, backups, and restricted user accounts. Biometric information will be limited to authorized adult guardians and handled only for the child-pickup verification purpose. Product, order, event, and AI-related records will also be restricted according to the needs of each user role.

**Legal and ethical feasibility:** The project involves information related to children and may also involve biometric information belonging to adult guardians; therefore, privacy, confidentiality, informed consent, purpose limitation, and responsible data handling will be respected during data collection, system development, testing, and evaluation. Access to real records will be restricted to authorized participants, and anonymity will be respected or sample data will be used whenever appropriate. The AI Parent Guide will be clearly limited to general informational recommendations and will not provide diagnosis, treatment, or professional counseling. Digital payments, where implemented, will be processed through the selected payment provider rather than by storing users' payment credentials inside the platform.

# 8. PROJECT SCHEDULE / TIMELINE

The project schedule is prepared from the task breakdown and follows the sequence of deliverables identified in the HiLCoE Senior Project Documentation Guideline. It also considers the Spring 2026 final project submission deadline of December 5, 2026. The timeline is presented in ten two-week periods so that the team can monitor progress and report major milestones.

| **No.** | **Activity**                                                                                     | **Expected Output**                        | **P1**             | **P2**        | **P3**         | **P4**              | **P5**         | **P6**              | **P7**         | **P8**             | **P9**        | **P10**            |
|---------|--------------------------------------------------------------------------------------------------|--------------------------------------------|--------------------|---------------|----------------|---------------------|----------------|---------------------|----------------|--------------------|---------------|--------------------|
|         |                                                                                                  |                                            | **Jul. 19-Aug. 1** | **Aug. 2-15** | **Aug. 16-29** | **Aug. 30-Sep. 12** | **Sep. 13-26** | **Sep. 27-Oct. 10** | **Oct. 11-24** | **Oct. 25-Nov. 7** | **Nov. 8-21** | **Nov. 22-Dec. 5** |
| 1       | Proposal completion, submission, review and correction                                           | Approved proposal                          | ●                  |               |                |                     |                |                     |                |                    |               |                    |
| 2       | Study of current daycare communication and reporting practice                                    | Current-system findings                    | ●                  | ●             |                |                     |                |                     |                |                    |               |                    |
| 3       | Interviews, questionnaires, observation and document review                                      | Collected requirements data                |                    | ●             | ●              |                     |                |                     |                |                    |               |                    |
| 4       | Requirements analysis and specification                                                          | SRS document and analysis models           |                    |               | ●              | ●                   |                |                     |                |                    |               |                    |
| 5       | System architecture, database, object and interface design                                       | SDD, ODD and prototypes                    |                    |               |                |                     | ●              |                     |                |                    |               |                    |
| 6       | Implementation Sprint 1: authentication, users and child profiles                                | Core account modules                       |                    |               |                |                     |                | ●                   |                |                    |               |                    |
| 7       | Implementation Sprint 2: attendance and daily activity reporting                                 | Activity-reporting modules                 |                    |               |                |                     |                |                     | ●              |                    |               |                    |
| 8       | Implementation Sprint 3: messaging, announcements, alerts, reports and simple events calendar    | Communication, reporting and event modules |                    |               |                |                     |                |                     |                | ●                  |               |                    |
| 9       | Implementation Sprint 4: AI Parent Guide, biometric guardian verification and daycare e-commerce | Advanced modules integrated                |                    |               |                |                     |                |                     |                | ●                  | ●             |                    |
| 10      | Integration, testing, user evaluation and correction of core and added modules                   | Test report and corrected system           |                    |               |                |                     |                |                     |                | ●                  | ●             |                    |
| 11      | Implementation report, user manual and final report compilation                                  | Draft final documentation                  |                    |               |                |                     |                |                     |                |                    | ●             | ●                  |
| 12      | Final review, printing, soft-copy preparation and submission                                     | Final project submission                   |                    |               |                |                     |                |                     |                |                    |               | ●                  |

**Legend:** A filled cell indicates the planned working period for the activity.

Project documentation, advisor consultation, version control, team meetings and milestone reporting will continue throughout the project. After the final document is submitted, the team will prepare the PowerPoint presentation and live software demonstration for the defense date assigned by the Project Coordinator.

# 9. REFERENCES

The references are presented according to the IEEE citation style required by the HiLCoE Senior Project Documentation Guideline. These sources support the project background, requirements work, software quality, security and accessibility considerations.

[1] HiLCoE, School of Computer Science and Technology, "Senior Project Documentation Guideline," ver. 1.4.3, 2024.

[2] HiLCoE, "Senior (Capstone) Project Kickoff Notice: Spring 2026," 2026.

[3] World Health Organization, United Nations Children's Fund, and World Bank Group, Nurturing Care for Early Childhood Development: A Framework for Helping Children Survive and Thrive to Transform Health and Human Potential. Geneva, Switzerland: World Health Organization, 2018.

[4] Office of Head Start, Administration for Children and Families, U.S. Department of Health and Human Services, "Family Engagement in Early Care and Education Learning Series," Feb. 13, 2024. \[Online\]. Available: https://headstart.gov/family-engagement/article/family-engagement-early-care-education-learning-series \[Accessed: Jul. 27, 2026\].

[5] Office of Head Start, Administration for Children and Families, U.S. Department of Health and Human Services, "1302.41 Collaboration and communication with parents," Oct. 4, 2024. \[Online\]. Available: https://headstart.gov/policy/45-cfr-chap-xiii/1302-41-collaboration-communication-parents \[Accessed: Jul. 27, 2026\].

[6] ISO/IEC/IEEE 29148:2018, Systems and Software Engineering—Life Cycle Processes—Requirements Engineering, 2018.

[7] ISO/IEC 25010:2023, Systems and Software Engineering—Systems and Software Quality Requirements and Evaluation (SQuaRE)—Product Quality Model, 2023.

[8] OWASP Foundation, "OWASP Application Security Verification Standard (ASVS)." \[Online\]. Available: https://owasp.org/www-project-application-security-verification-standard/ \[Accessed: Jul. 27, 2026\].

[9] World Wide Web Consortium, Web Content Accessibility Guidelines (WCAG) 2.2, W3C Recommendation, Oct. 5, 2023. \[Online\]. Available: https://www.w3.org/TR/WCAG22/ \[Accessed: Jul. 27, 2026\].

[10] Chapa, "Developer Documentation - Accept Payments and API Integration." \[Online\]. Available: https://developer.chapa.co/ \[Accessed: Aug. 21, 2026\].

[11] Federal Democratic Republic of Ethiopia, "Personal Data Protection Proclamation, Proclamation No. 1321/2024," Ministry of Justice, Jul. 24, 2024. \[Online\]. Available: https://justice.gov.et/en/law/personal-data-protection-proclamation/ \[Accessed: Aug. 21, 2026\].

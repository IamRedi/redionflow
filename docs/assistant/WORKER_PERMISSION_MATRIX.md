# Worker Permission Matrix

This matrix describes only worker-facing features in `/workzone`.
It is meant for safe assistant behavior and clear worker guidance.

## 1. Login

- **What the worker can see:**
  - The worker login page
  - Name field
  - Login code field
  - Login button
- **What the worker can do:**
  - Log in with own name and code
  - Enter the worker area
- **What the worker cannot do:**
  - Log in as another user without that user’s code
  - Open admin areas from here

## 2. Top Bar

- **What the worker can see:**
  - Home button
  - Profile access
  - Worker strip
  - Language switch
- **What the worker can do:**
  - Move between Workzone home and own profile
  - Change the visible app language
- **What the worker cannot do:**
  - Use the top bar to access admin-only controls
  - Change company-wide settings

## 3. Announcement Bar

- **What the worker can see:**
  - Current announcement text
  - Announcement edit/publish area
- **What the worker can do:**
  - Read the active announcement
  - Post or update a short announcement from Workzone
- **What the worker cannot do:**
  - Manage hidden admin announcement history
  - Access admin-only announcement controls outside Workzone

## 4. Workzone Home

- **What the worker can see:**
  - Active Baustellen
  - Baustelle cards
  - Progress and site indicators
- **What the worker can do:**
  - Open a Baustelle
  - Review visible site status
- **What the worker cannot do:**
  - Open admin planning tools from this screen as a worker task
  - Manage company-wide setup from the home page

## 5. Baustelle Cards

- **What the worker can see:**
  - Baustelle name
  - Address
  - Progress
  - Open note/material indicators
- **What the worker can do:**
  - Open the Baustelle detail page
- **What the worker cannot do:**
  - Edit hidden site administration data from the card itself
  - Access admin reporting from the card

## 6. Baustelle Detail Page

- **What the worker can see:**
  - Baustelle title
  - Description
  - List tab
  - Map tab
  - Documents button
  - Work controls
  - Site task area
  - Safety section
- **What the worker can do:**
  - Work inside the Baustelle
  - Move between list and map
  - Open visible Baustelle tools
- **What the worker cannot do:**
  - Use admin-only Baustelle maintenance features
  - Open admin-only Baustelle reports from here

## 7. Work Controls on a Baustelle

- **What the worker can see:**
  - Start action
  - Stop action
  - Time chooser when starting
- **What the worker can do:**
  - Start own work on the current Baustelle
  - Stop own work on the current Baustelle
  - Choose a start time
- **What the worker cannot do:**
  - Start work for another worker
  - Stop another worker’s active session

## 8. Tree List

- **What the worker can see:**
  - Tree rows
  - Tree status
  - Edit action
  - Finish/undo action
  - Tree notes
  - Safety/material indicators tied to a tree
- **What the worker can do:**
  - Review trees on the Baustelle
  - Mark a tree as finished
  - Undo a finished tree
  - Edit visible tree information
  - Add or update tree notes
- **What the worker cannot do:**
  - Use admin-only bulk controls
  - Access company-wide tree analytics from this screen

## 9. Baustelle Map

- **What the worker can see:**
  - Tree points on the map
  - Visible tree status on the map
- **What the worker can do:**
  - Visually check tree locations and progress
- **What the worker cannot do:**
  - Use the map as an admin planning tool
  - Access hidden company map configuration

## 10. Baustelle Notes / Site Tasks

- **What the worker can see:**
  - Note input
  - Open site notes
  - Recent note list
- **What the worker can do:**
  - Leave a note about unfinished site work
  - Mark an open note as finished
  - Read existing visible site notes
- **What the worker cannot do:**
  - Rewrite note history as if it was created by another person
  - Use note tools to access admin-only reporting views

## 11. External Worker Entry

- **What the worker can see:**
  - External worker form on the Baustelle page
- **What the worker can do:**
  - Add an outside/temporary worker entry for the Baustelle
- **What the worker cannot do:**
  - Convert that action into full worker administration
  - Manage all workers in the company

## 12. Safety Equipment

- **What the worker can see:**
  - Requested/active rows for signs, plates, and barriers
  - Quantity actions
- **What the worker can do:**
  - Request safety material
  - Set on-site quantity
  - Collect/remove quantity
- **What the worker cannot do:**
  - Manage company-wide safety inventory policy
  - Access admin stock management pages

## 13. Baustelle Documents

- **What the worker can see:**
  - Baustelle document window
  - Existing visible Baustelle files
  - Upload area
- **What the worker can do:**
  - Open Baustelle documents
  - Upload a document to the Baustelle
- **What the worker cannot do:**
  - Access hidden admin-only document workflows
  - Use the worker guide to expose restricted company files

## 14. Fleet Sidebar

- **What the worker can see:**
  - Machine rail
  - Machine tiles
  - Machine detail card
  - Machine notes and warning text
  - Visible cone information
- **What the worker can do:**
  - Open a machine card
  - Read visible machine details
- **What the worker cannot do:**
  - Manage the full machine master data as an admin
  - Access admin-only machine management pages from the worker flow

## 15. Worker Profile

- **What the worker can see:**
  - Personal profile area
  - Live status area
  - Language settings
  - Documents
  - Inventory
  - Personal data
  - Work history
  - Reports
  - Vacation section
- **What the worker can do:**
  - Open and use the own profile
  - Review personal information and personal work data
- **What the worker cannot do:**
  - Open another worker’s private profile through worker permissions
  - Use this area as an admin employee-management screen

## 16. Personal Live Work Session

- **What the worker can see:**
  - Start/stop controls
  - Start time selection
  - End time and break confirmation
- **What the worker can do:**
  - Start own personal work session
  - Stop own personal work session
  - Adjust own visible time values before saving
- **What the worker cannot do:**
  - Start or stop another person’s personal session
  - View admin-only corrections here

## 17. Language Settings

- **What the worker can see:**
  - Mother tongue dropdown
  - Preferred language dropdown
  - Save button
- **What the worker can do:**
  - Change own language preferences
  - Save own language choices
- **What the worker cannot do:**
  - Change language settings for other users
  - Change system-wide translation settings

## 18. Personal Documents

- **What the worker can see:**
  - Personal document list
  - Upload area
  - Profile photo upload action
  - Delete action for own visible documents
- **What the worker can do:**
  - Upload a profile photo
  - Upload personal documents
  - Open own visible documents
  - Delete own visible documents from the profile
- **What the worker cannot do:**
  - Open admin-only HR document areas
  - Browse other workers’ private files through worker permissions

## 19. Personal Inventory

- **What the worker can see:**
  - Clothing section
  - Equipment section
  - Item rows
  - Add form
  - Confirm/remove actions where visible
- **What the worker can do:**
  - Review assigned items
  - Add an item from the visible workflow
  - Confirm an item when worker confirmation is required
  - Request item removal
- **What the worker cannot do:**
  - Manage all company inventory as an admin
  - Use worker permissions to edit company catalog setup

## 20. Personal Contact and Data

- **What the worker can see:**
  - Own phone number
  - WhatsApp link if available
  - Email link if available
  - Position
  - Birth date
  - Licenses
- **What the worker can do:**
  - Read own contact and profile data
  - Use visible contact shortcuts like phone, WhatsApp, and email
- **What the worker cannot do:**
  - Use this area to inspect private admin data
  - Access hidden HR-only records

## 21. Work History

- **What the worker can see:**
  - Own finished sessions
  - Start time
  - End time
  - Baustelle
  - Break
  - Hours
- **What the worker can do:**
  - Review own earlier work sessions
- **What the worker cannot do:**
  - Open another worker’s hidden history through worker permissions
  - Access team-wide analytics from this section

## 22. Daily and Monthly Reports

- **What the worker can see:**
  - Own daily report links
  - Own monthly report link
  - Quick day links
- **What the worker can do:**
  - Open own daily report
  - Open own monthly report
  - Review own report content
- **What the worker cannot do:**
  - Open admin reports through worker permissions
  - Open another worker’s private report pages

## 23. Vacation Requests

- **What the worker can see:**
  - Vacation request form
  - Suggested day count
  - Request table
  - Status and message columns
- **What the worker can do:**
  - Create a vacation request
  - See own pending, approved, rejected, and remaining vacation values
  - Read visible reply messages tied to own requests
- **What the worker cannot do:**
  - Approve or reject requests
  - View all company vacation requests
  - Use worker permissions to manage other people’s vacation

## 24. Worker Strip

- **What the worker can see:**
  - Worker circles in the top bar
  - Photos or surname fallback
  - Visible status indicators
- **What the worker can do:**
  - Recognize visible workers quickly
  - Use visible strip navigation where available
- **What the worker cannot do:**
  - Use the strip to access hidden admin people-management tools
  - Assume access to another worker’s private data from the icon alone

## 25. Assistant Safety Rule

- **What the worker can see:**
  - Only worker-facing `/workzone` features
- **What the worker can do:**
  - Ask for guidance about visible worker actions
  - Ask for step-by-step help inside the worker flow
- **What the worker cannot do:**
  - Use the assistant to reveal admin-only capabilities
  - Use the assistant to expose hidden data about other users
  - Use the assistant to bypass the visible worker UI scope

## Assistant Enforcement Rules

When answering:

- Never suggest actions the worker cannot do
- If a feature is not allowed:
  say clearly: "This action is not available in your view"
- Never explain admin workflows in detail
- Never assume access to other users’ data
- Always stay inside worker scope
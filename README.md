# 🕚 TiTo Time Tracker - v 1.09.0

TiTo Time Tracker is a simple, efficient web application for tracking time spent on various projects. It allows users to manage projects, record time entries, and visualize their time allocation.

## Features

### 1. **Core User Experience (UX) Features**
   - Clean three-column layout for easy navigation
   - Multi-lingual support
   - Dark mode
   - Support for screen reader (tested with Orca on Linux Mint)
   - Support for keyboard navigation (tested in Chrome on Linux Mint)
   - Help modal
   - Info icon for quick access to app information and links

### 2. **Core Time Tracking Features**
   - Start and stop a timer for active time tracking
   - Add manual time entries
   - View and edit time entries with custom date and time inputs
   - Create and manage multiple projects
   - Drag-and-drop interface for reordering projects and time entries

### 3. **Time Entry Management**
   - Paginated time entries list with customizable entries per page (5, 10, 20, 30, custom, or all)
   - Editable page number for quick navigation through time entries

### 4. **Reporting and Visualization**
   - Charts displaying time spent on different projects:
     - Overall time distribution
     - Time spent in selected date ranges
   - Monthly or weekly reports with export to CSV, PDF, or markdown
   - Date range selection for detailed data analysis

### 5. **Technical and Functional Features**
   - Local data storage using IndexedDB
   - Import/Export of database from/into .JSON-file for backup and transfer
   - Offline functionality - works entirely in the browser

### 6. **Technical Stack**
   - Built with vanilla JavaScript, HTML, and CSS

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Opera, or Edge)
- An internet connection (for initial download only; the app works offline once downloaded)

### Installation

1. Visit the [official website](https://bjornkennethholmstrom.wordpress.com/tito/)
2. Download the TiTo Time Tracker zip file
3. Extract the contents of the zip file to a location on your computer
4. Open the extracted folder and find the `index.html` file
5. Double-click on `index.html` to open it in your default web browser

### Recommended: Create a Bookmark

For quick and easy access to TiTo Time Tracker, create a bookmark in your browser:

1. Open the `index.html` file in your browser as described above
2. Create a bookmark (usually by pressing Ctrl+D or Cmd+D, or by clicking the star icon in the address bar)
3. Optionally, move the bookmark to your bookmarks bar for one-click access

This will allow you to open the time tracker quickly whenever you need it, enhancing your productivity.

## Usage

Adding a Project:
- Enter a project name in the "Enter new project name" field.
- Click "Add Project" or press Enter.

Starting Time Tracking:
- Select a project from the list.
- Click the play button to start the timer.

Stopping Time Tracking:
- Click the stop button to end the time entry.

Adding Manual Entries:
- Click "Add Manual Entry" in the Time Entries section.
- Adjust the start and end times as needed.

Editing Time Entries:
- Click on the time or description of an existing entry to edit it.

Navigating Time Entries:
- Use the pagination controls at the bottom of the time entries list to navigate between pages.
- Click on the current page number to edit it directly and jump to a specific page.

Customizing Entries Per Page:
- Use the "Entries per page" dropdown to select how many time entries to display (5, 10, 20, 30, custom, or all).

Reordering Projects:
- Drag and drop projects in the list to reorder them.

Deleting Projects or Time Entries:
- Click the trash can icon (🗑️) next to a project or time entry to delete it.

Generating Reports:
- Navigate to the "Reports" tab in the chart and visualization section.
- Select either "Weekly Summary" or "Monthly Summary".
- Choose the date range for your report.
- Use the drag select feature to quickly select multiple projects for the report.
- Click "Generate Report" to create your report.
- Use the export buttons to download the report in CSV, PDF, or Markdown format.

Exporting Reports:
- After generating a report, click on the desired export format (CSV, PDF, or Markdown).
- For Markdown exports, the report is optimized for readability with preserved project names and aligned columns.
- PDF exports feature a clean, table-like structure with proper page breaks for longer reports.

Exporting Data:
- Click the "Export Database" button to save all your project and time entry data as a JSON file.
- This file can be used for backup purposes or to transfer data to another device.

Importing Data:
- Click the "Import Database" button to load previously exported data.
- Select the JSON file you want to import.
- Note: Importing data will overwrite your current data, so use this feature carefully.

Data Storage and Management:
- TiTo uses your browser's IndexedDB to store all data locally on your device.
- Your data persists between sessions and no account creation is required.
- To clear all data, use the "Clear Database" button at the bottom of the project list.

Accessing App Information:
- Click the info icon (ℹ️) next to the app title to view version information and important links.

## Known Limitations

- Data is stored locally and is not synced across devices

## Future Plans

- Improved aesthetics
- Customizable report templates
- Time goals
- Enhanced data visualization
- More languages

## License

See the included file named LICENSE

## Contributing

We welcome contributions to TiTo Time Tracker! If you have suggestions for improvements or encounter any issues, please contact me through my website at 
https://bjornkennethholmstrom.wordpress.com/contact/

You can also support the development by donating at 
https://bjornkennethholmstrom.wordpress.com/support/
Any amount is greatly appreciated!

## Acknowledgments

- Claude, an AI assistant created by Anthropic, for assistance in development and documentation
- My family for support and infrastructure

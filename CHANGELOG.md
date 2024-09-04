# CHANGELOG

## TiTo 1.05

### Features added and issues resolved

1. User Interface Improvements:
   - Redesigned the header area, removing the large official website button for a cleaner look.
   - Added an info icon (ℹ️) next to the title, providing quick access to app information and links.
   - Improved the layout of time entry items, placing the remove button on the same line as the description for a more compact view.
   - Added 5 as an option for the number of time entries displayed per page.

2. Navigation Enhancements:
   - Made the current page number in the time entry pagination editable, allowing users to jump directly to a specific page.

3. Accessibility and User Experience:
   - Improved the visibility and usability of the official website and support links.
   - Enhanced the overall layout for better space utilization and readability.

4. Code Refactoring:
   - Reorganized and cleaned up the CSS file for better maintainability.
   - Updated JavaScript functions to handle new UI elements and functionality.
   - Reorganized and cleaned up codebase for better maintainability

5. Documentation:
   - Updated README.md with current features and usage instructions.
   - Updated CHANGELOG.md to reflect recent changes.

## TiTo 1.04

### Features added and issues resolved

1. User Interface Improvements:
   - Added pages for the time entry list.
   - Redesigned the header area.
     - Improved layout of the title, version number, and subtitle.
     - Enhanced the styling of the official website link.
     - Adjusted the timer section.

2. Bug Fixes:
   - Resolved an issue where time entries were not displayed upon initial load.
   - Fixed inconsistencies in the entries per page functionality.

3. Documentation:
   - Updated README.md with current features and future plans.

## TiTo 1.03

### Features added and issues resolved

1. Chart Visualization Enhancements:
   - Implemented a new time range selection feature for more detailed data analysis.
   - Added a pie chart to visualize time distribution across projects within a selected date range.
   - Introduced quick date range selection options (Today, This Week, This Month, Last 7 Days, Last 30 Days).
   - Expanded the color palette for better visual distinction between multiple projects (up to 30 unique colors).

2. Date Range Functionality:
   - Added date range inputs for custom time period selection.
   - Implemented logic to handle various date range scenarios, including 'Today', 'This Week', and custom ranges.

3. User Interface Improvements:
   - Created a tabbed interface to switch between overall time chart and time range charts.
   - Improved visibility of chart view selection buttons with better color contrast.

4. Data Filtering and Calculation:
   - Enhanced time entry filtering to accurately reflect selected date ranges.
   - Improved calculation of project totals for specific time periods.

5. Bug Fixes:
   - Resolved issues with the 'Today' view incorrectly including data from the previous day.
   - Fixed date range selection to properly handle time zone differences.

6. Performance and Reliability:
   - Optimized database queries for faster data retrieval in different date ranges.
   - Improved error handling and logging for better diagnostics.

7. Code Refactoring:
   - Restructured chart rendering functions for better maintainability.
   - Improved modularity of date handling and chart updating functions.

## TiTo 1.02

### Features added and issues resolved

1. Project List Improvements:
   - Added a scrollbar to the project list when it exceeds the container height.
   - Implemented drag-and-drop functionality for reordering projects.
   - Ensured project selection and deletion work correctly after reordering.

2. Time Entry List Improvements:
   - Implemented drag-and-drop functionality for reordering time entries.
   - Added a "Sort Oldest First" and "Sort Newest First"-buttons to sort time entries chronologically.
   - Improved the display and editing of time entries with custom date and time inputs.

3. Chart Visualization:
   - Updated the project chart to display projects in the same order as the project list.
   - Ensured the chart updates correctly when projects are reordered or when time entries are modified.

4. Database Operations:
   - Implemented export and import functionality for the database.

5. User Interface Enhancements:
   - Added visual feedback for drag-and-drop operations.

6. Bug Fixes:
   - Resolved issues with project selection after reordering.
   - Fixed problems with updating the database when reordering projects and time entries.
   - Corrected the display of time inputs to consistently use 24-hour format.

7. Performance and Reliability:
   - Ensured proper initialization of the IndexedDB database.



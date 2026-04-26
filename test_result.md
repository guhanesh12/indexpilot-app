#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Build a React Native (Expo) mobile app that mirrors the existing IndexPilotAI website.
  Connects to live Supabase backend via FastAPI proxy. Features: dashboard (wallet, P&L, live prices),
  instrument symbol management (Dhan CSV download, target/SL/trailing options), broker setup,
  trading journal, support ticketing, logs, PIN lock auth, Razorpay (Add Funds), Firebase Push.

backend:
  - task: "Engine Stop sync with Supabase (defensive multi-call)"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/lib/api.ts, /app/frontend/app/(tabs)/home.tsx"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "user"
        comment: "User reported app shows STOPPED but website engine keeps running."
      - working: "NA"
        agent: "main"
        comment: "Made stopEngine defensive: now sends explicit body { isRunning:false, enabled:false, force:true } to /engine/stop AND force-overwrites /engine/state. Verifies via /engine/db-status after 1.5s, retries once if still running."

  - task: "Position Monitor proxy"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py (proxy), /app/frontend/src/lib/api.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/edge/positions/monitor/active wired through. Proxy already supports any /edge/* path."

frontend:
  - task: "Symbols array mutation bug (CE→PE corruption)"
    implemented: true
    working: true
    file: "/app/frontend/app/(tabs)/symbols.tsx"
    stuck_count: 1
    priority: "high"
    needs_retesting: false
    status_history:
      - working: false
        agent: "user"
        comment: "Adding PUT after CALL was overwriting the CALL into UNKNOWN/PUT and dropping trailing SL."
      - working: true
        agent: "main"
        comment: "Root cause: server stores fields nested in raw_data, but normalize() only checked top-level. Fixed: normalize now extracts optionType, target/SL, trailing fields from raw_data fallback. Verified via screenshot — both NIFTY-Apr2026-25500-CE (CALL green) and NIFTY-Apr2026-25600-PE (PUT red) coexist with Trail preserved."

  - task: "Position Monitor on Dashboard"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/home.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added new section using GET /positions/monitor/active. Renders MonitorRow with action badge (HOLD/EXIT/TRAIL), color-coded P&L, AI reason text. Hidden when empty."

  - task: "Firebase Push graceful no-op in Expo Go"
    implemented: true
    working: true
    file: "/app/frontend/src/lib/push.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: false
        agent: "main"
        comment: "Static import of expo-notifications was crashing Expo Go preview at app start (SDK 53 removed Android push from Expo Go)."
      - working: true
        agent: "main"
        comment: "Rewrote push.ts to lazy-load expo-notifications/expo-device only when canUsePush=true (not Expo Go, not web). Bundle now compiles cleanly and logs '[Push] Skipped — Expo Go or web'."

metadata:
  created_by: "main_agent"
  version: "1.3"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "Engine Stop sync with Supabase (defensive multi-call)"
    - "Position Monitor proxy"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Two P0 bugs + one P1 task delivered:
      1) Symbols mutation FIXED & verified visually (screenshot shows CE+PE coexisting with Trail).
      2) Engine Stop now uses defensive multi-call (stop + state-overwrite + verify+retry).
      3) Position Monitor section added to dashboard (renders only when API returns positions).
      4) Bonus: fixed Expo Go crash from expo-notifications by lazy-loading.

      Please test backend proxy endpoints:
      - POST /api/edge/engine/stop with body { isRunning:false, enabled:false, force:true } using guhanesh1234@gmail.com creds
      - POST /api/edge/engine/state with body { isRunning:false, enabled:false, status:'stopped' }
      - GET /api/edge/engine/db-status — should reflect stop after the above
      - GET /api/edge/positions/monitor/active — verify it forwards correctly
      - GET /api/edge/symbols/get — verify response shape (snake_case + raw_data) matches our normalizer
      Test creds: email=guhanesh1234@gmail.com, password=Ranji@9600 (live Supabase JWT auth via /api/sb/auth/v1/token).

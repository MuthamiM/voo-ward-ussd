"""
USSD Service for Kyamatu Ward
Handles USSD menu navigation and session management
"""

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import json

router = APIRouter()

# USSD Session Store (in production, use Redis)
ussd_sessions = {}

class USSDRequest(BaseModel):
    sessionId: str
    serviceCode: str
    phoneNumber: str
    text: str

class USSDMenus:
    MAIN_MENU = """CON Welcome to VOO Ward Services
1. Register as Voter
2. Report an Issue
3. Check Issue Status
4. My Registration
5. Announcements
6. Contact Us
0. Exit"""

    VOTER_REG_MENU = """CON Voter Registration
1. Start New Registration
2. Check Registration Status
0. Back to Main Menu"""

    ISSUE_CATEGORY_MENU = """CON Select Issue Category:
1. Water
2. Roads
3. Electricity
4. Security
5. Health
6. Waste
7. Other
0. Back"""

    ISSUE_STATUS_MENU = """CON Check Issue Status:
1. My Issues (by phone)
2. Specific Ticket Number
0. Back"""

    ANNOUNCEMENTS_MENU = """CON Latest Announcements:
1. Water Maintenance - 25th Nov
2. Town Hall Meeting - 30th Nov
3. Road Closure Alert
0. Back"""

    CONTACT_MENU = """END Contact Information:
Ward Office: +254 XXX XXX XXX
Email: kyamatu@ward.go.ke
Hours: Mon-Fri, 8AM-5PM

Emergency: 999"""

def get_session(session_id: str) -> dict:
    """Get or create USSD session"""
    if session_id not in ussd_sessions:
        ussd_sessions[session_id] = {
            'created_at': datetime.now(),
            'menu_history': [],
            'data': {}
        }
    return ussd_sessions[session_id]

def clean_old_sessions():
    """Remove sessions older than 30 minutes"""
    cutoff = datetime.now() - timedelta(minutes=30)
    to_remove = [
        sid for sid, session in ussd_sessions.items()
        if session['created_at'] < cutoff
    ]
    for sid in to_remove:
        del ussd_sessions[sid]

@router.post("/callback")
async def ussd_callback(request: USSDRequest):
    """Handle USSD callback from Africa's Talking"""
    
    clean_old_sessions()
    session = get_session(request.sessionId)
    user_input = request.text
    
    # Parse user input
    inputs = user_input.split('*') if user_input else []
    current_level = len(inputs)
    
    # Main menu
    if current_level == 0:
        return Response(content=USSDMenus.MAIN_MENU, media_type="text/plain")
    
    # Level 1: Main menu selection
    main_choice = inputs[0]
    
    if main_choice == '1':  # Voter Registration
        if current_level == 1:
            return Response(content=USSDMenus.VOTER_REG_MENU, media_type="text/plain")
        elif current_level == 2:
            sub_choice = inputs[1]
            if sub_choice == '1':  # Start registration
                return Response(
                    content="CON Enter your National ID Number:",
                    media_type="text/plain"
                )
            elif sub_choice == '2':  # Check status
                return Response(
                    content="CON Enter your National ID to check status:",
                    media_type="text/plain"
                )
        elif current_level == 3:
            # Store ID and ask for name
            session['data']['national_id'] = inputs[2]
            return Response(
                content="CON Enter your Full Name:",
                media_type="text/plain"
            )
        elif current_level == 4:
            # Store name and confirm
            session['data']['full_name'] = inputs[3]
            return Response(
                content=f"""END Registration Submitted!
Name: {session['data']['full_name']}
ID: {session['data']['national_id']}

You will receive SMS confirmation within 24 hours.
Download our app for faster service!""",
                media_type="text/plain"
            )
    
    elif main_choice == '2':  # Report Issue
        if current_level == 1:
            return Response(content=USSDMenus.ISSUE_CATEGORY_MENU, media_type="text/plain")
        elif current_level == 2:
            categories = ['Water', 'Roads', 'Electricity', 'Security', 'Health', 'Waste', 'Other']
            cat_index = int(inputs[1]) - 1
            if 0 <= cat_index < len(categories):
                session['data']['category'] = categories[cat_index]
                return Response(
                    content="CON Describe the issue (keep it brief):",
                    media_type="text/plain"
                )
        elif current_level == 3:
            # Store description and generate ticket
            session['data']['description'] = inputs[2]
            ticket = f"ISS{datetime.now().strftime('%Y%m%d')}-{request.sessionId[:4]}"
            return Response(
                content=f"""END Issue Reported!
Ticket: {ticket}
Category: {session['data']['category']}

You will receive SMS updates.
Track via app or dial *384*3#""",
                media_type="text/plain"
            )
    
    elif main_choice == '3':  # Check Issue Status
        if current_level == 1:
            return Response(content=USSDMenus.ISSUE_STATUS_MENU, media_type="text/plain")
        elif current_level == 2:
            sub_choice = inputs[1]
            if sub_choice == '1':  # My issues
                return Response(
                    content=f"""END Your Issues:
1. ISS20241122-0001 (Pending)
2. ISS20241120-0045 (Resolved)

For details, check the app or SMS""",
                    media_type="text/plain"
                )
            elif sub_choice == '2':  # Specific ticket
                return Response(
                    content="CON Enter Ticket Number:",
                    media_type="text/plain"
                )
    
    elif main_choice == '4':  # My Registration
        return Response(
            content="CON Enter your National ID:",
            media_type="text/plain"
        )
    
    elif main_choice == '5':  # Announcements
        return Response(content=USSDMenus.ANNOUNCEMENTS_MENU, media_type="text/plain")
    
    elif main_choice == '6':  # Contact
        return Response(content=USSDMenus.CONTACT_MENU, media_type="text/plain")
    
    elif main_choice == '0':  # Exit
        return Response(content="END Thank you for using VOO Ward Services!", media_type="text/plain")
    
    # Default fallback
    return Response(
        content="END Invalid selection. Please try again.",
        media_type="text/plain"
    )

@router.post("/session/save")
async def save_session(session_id: str, data: dict):
    """Save session data"""
    session = get_session(session_id)
    session['data'].update(data)
    return {"status": "saved"}

@router.get("/session/{session_id}")
async def get_session_data(session_id: str):
    """Get session data"""
    session = get_session(session_id)
    return session

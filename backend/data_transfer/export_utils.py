from io import BytesIO
from copy import copy
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle

from timetable.models import ScheduledClass


def get_schedule_queryset(run_obj):
    """Shared query logic for both data_transfer to prevent duplication."""
    return (
        ScheduledClass.objects
        .filter(run=run_obj)
        .select_related(
            "assignment__prof__user",
            "assignment__subject",
            "assignment__section",
            "room",
        )
        .order_by("day", "start_time")
    )


def generate_schedule_excel(run_obj):
    """Generates an Excel workbook for the given schedule run."""
    classes = get_schedule_queryset(run_obj)

    wb = Workbook()
    ws = wb.active
    ws.title = "Schedule"

    ws.append([
        "Day",
        "Start",
        "End",
        "Subject Code",
        "Title",
        "Section",
        "Professor",
        "Room",
        "Mode",
    ])

    for c in classes:
        prof_user = c.assignment.prof.user
        professor_name = prof_user.get_full_name() or prof_user.username
        ws.append([
            c.get_day_display(),
            c.start_time.strftime("%H:%M"),
            c.end_time.strftime("%H:%M"),
            c.assignment.subject.code,
            c.assignment.subject.title,
            c.assignment.section.name,
            professor_name,
            c.room.name if c.room else "",
            c.get_mode_display() if c.mode else "",
        ])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    
    return buf


def generate_schedule_pdf(run_obj):
    """Generates a landscape PDF matching the Excel column layout."""
    classes = get_schedule_queryset(run_obj)
    buf = BytesIO()
    
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=1*cm,
        rightMargin=1*cm,
        topMargin=1*cm,
        bottomMargin=1*cm,
    )

    styles = getSampleStyleSheet()
    header_style = copy(styles["Normal"])
    header_style.fontName = "Helvetica-Bold"
    header_style.fontSize = 8
    header_style.textColor = colors.white
    
    cell_style = copy(styles["Normal"])
    cell_style.fontName = "Helvetica"
    cell_style.fontSize = 8

    # 1. Define Headers matching Excel exactly
    headers = [
        "Day", "Start", "End", "Subject Code", 
        "Title", "Section", "Professor", "Room", "Mode"
    ]
    
    data = [[Paragraph(h, header_style) for h in headers]]

    # 2. Populate Data
    for c in classes:
        prof_user = c.assignment.prof.user
        professor_name = prof_user.get_full_name() or prof_user.username
        
        row = [
            Paragraph(c.get_day_display(), cell_style),
            Paragraph(c.start_time.strftime("%H:%M"), cell_style),
            Paragraph(c.end_time.strftime("%H:%M"), cell_style),
            Paragraph(c.assignment.subject.code, cell_style),
            Paragraph(c.assignment.subject.title, cell_style),  # Paragraph allows text wrapping
            Paragraph(c.assignment.section.name, cell_style),
            Paragraph(professor_name, cell_style),              # Paragraph allows text wrapping
            Paragraph(c.room.name if c.room else "", cell_style),
            Paragraph(c.get_mode_display() if c.mode else "", cell_style),
        ]
        data.append(row)

    # 3. Table Layout & Styling
    # Total width of A4 Landscape is ~29.7cm. Usable width is ~27.7cm (with 1cm margins)
    col_widths = [
        2.5*cm,  # Day
        1.5*cm,  # Start
        1.5*cm,  # End
        2.5*cm,  # Code
        6.0*cm,  # Title (reduced from 7.0)
        2.0*cm,  # Section
        4.5*cm,  # Professor (reduced from 5.0)
        3.0*cm,  # Room (reduced from 3.5)
        4.0*cm,  # Mode (increased from 2.0)
    ]
    
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9f9f9")]), # Adds striped rows for readability
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#bdc3c7")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))

    title = Paragraph(f"{run_obj.term.get_semester_display() if run_obj.term else "N/A"}, AY {run_obj.term.year if run_obj.term else "N/A"}", styles["Title"])
    doc.build([title, table])

    buf.seek(0)
    return buf

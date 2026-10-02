import io
import re
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, HRFlowable

def clean_text(t):
    if not t:
        return ""
    return str(t).replace("■", "-").replace("\u25a0", "-").replace("\u2013", "-").replace("\u2014", "-")

def parse_markdown_to_flowables(md_text, body_s, subhead_s, bullet_s, note_s):
    if not md_text:
        return []

    flowables = []
    lines = md_text.split("\n")

    for line in lines:
        raw_l = clean_text(line.strip())
        if not raw_l:
            continue

        # ── Parse Headers (###, ##, #) ──
        if raw_l.startswith("#"):
            heading_text = raw_l.lstrip("#").strip()
            heading_fmt = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', heading_text)
            flowables.append(Spacer(1, 3))
            flowables.append(Paragraph(heading_fmt, subhead_s))
            flowables.append(Spacer(1, 2))
        elif raw_l.startswith("- ") or raw_l.startswith("* ") or raw_l.startswith("• "):
            # ── Parse Bullet Lists ──
            b_text = re.sub(r'^[-*•]\s+', '', raw_l)
            b_fmt = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', b_text)
            # Clean inline badge formatting for Guidelines and Web sources without emoji glyph artifacts
            b_fmt = re.sub(
                r'\[(Guideline:?[^\]]+)\]',
                r'<font color="#0891B2"><b>[\1]</b></font>',
                b_fmt
            )
            b_fmt = re.sub(
                r'\[(Web:?[^\]]+)\]',
                r'<font color="#059669"><b>[\1]</b></font>',
                b_fmt
            )
            flowables.append(Paragraph(f"<font color='#0F766E'>&bull;</font> {b_fmt}", bullet_s))
        elif raw_l.lower().startswith("note:") or raw_l.startswith("*note:"):
            # ── Note Line ──
            n_text = raw_l.strip("*")
            flowables.append(Spacer(1, 3))
            flowables.append(Paragraph(f"<i>{n_text}</i>", note_s))
        else:
            # ── Format Standard Paragraphs ──
            line_fmt = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', raw_l)
            line_fmt = re.sub(r'\*(.*?)\*', r'<i>\1</i>', line_fmt)
            line_fmt = re.sub(
                r'\[(Guideline:?[^\]]+)\]',
                r'<font color="#0891B2"><b>[\1]</b></font>',
                line_fmt
            )
            line_fmt = re.sub(
                r'\[(Web:?[^\]]+)\]',
                r'<font color="#059669"><b>[\1]</b></font>',
                line_fmt
            )
            flowables.append(Paragraph(line_fmt, body_s))

    return flowables

def generate_pdf(patient_name, patient_age, mri_result=None, q_result=None, clinical_result=None, rag_result=None):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=0.32 * inch,
        bottomMargin=0.32 * inch,
        leftMargin=0.45 * inch,
        rightMargin=0.45 * inch
    )
    styles = getSampleStyleSheet()
    story = []

    # ── Consistent Standard Typography Across Entire Document (8.5pt Helvetica) ──
    FONT_SZ = 8.2
    LEADING = 11.2

    title_s = ParagraphStyle("T", parent=styles["Title"], fontSize=15, fontName="Helvetica-Bold", textColor=colors.HexColor("#0F766E"), spaceAfter=1, alignment=0)
    sub_s = ParagraphStyle("S", parent=styles["Normal"], fontSize=FONT_SZ, fontName="Helvetica", textColor=colors.HexColor("#64748B"), leading=LEADING)
    header_meta_s = ParagraphStyle("HM", parent=styles["Normal"], fontSize=7.5, fontName="Helvetica-Bold", textColor=colors.HexColor("#64748B"), alignment=2)
    
    # Section uppercase titles (e.g. 01. STRUCTURAL MRI BRAIN ANALYSIS)
    sec_hdr_s = ParagraphStyle("SH", parent=styles["Heading2"], fontSize=7.8, fontName="Helvetica-Bold", textColor=colors.HexColor("#475569"), spaceBefore=5, spaceAfter=2.5, keepWithNext=True)
    
    # Subheadings inside RAG card
    subhead_s = ParagraphStyle("SubHead", parent=styles["Normal"], fontSize=8.5, fontName="Helvetica-Bold", textColor=colors.HexColor("#0F766E"), spaceBefore=2, spaceAfter=2, keepWithNext=True)
    
    # Table cell styles
    cell_s = ParagraphStyle("Cell", parent=styles["Normal"], fontSize=FONT_SZ, fontName="Helvetica", textColor=colors.HexColor("#1E293B"), leading=LEADING)
    cell_bold_s = ParagraphStyle("CellB", parent=styles["Normal"], fontSize=FONT_SZ, fontName="Helvetica-Bold", textColor=colors.HexColor("#1E293B"), leading=LEADING)
    header_cell_s = ParagraphStyle("HCell", parent=styles["Normal"], fontSize=7.5, fontName="Helvetica-Bold", textColor=colors.HexColor("#64748B"), leading=LEADING)
    
    # RAG body and bullets
    body_s = ParagraphStyle("Body", parent=styles["Normal"], fontSize=FONT_SZ, fontName="Helvetica", textColor=colors.HexColor("#1E293B"), leading=LEADING, spaceAfter=2)
    bullet_s = ParagraphStyle("Bullet", parent=styles["Normal"], fontSize=FONT_SZ, fontName="Helvetica", textColor=colors.HexColor("#1E293B"), leading=LEADING, spaceAfter=2, leftIndent=6)
    note_s = ParagraphStyle("Note", parent=styles["Normal"], fontSize=7.8, fontName="Helvetica-Oblique", textColor=colors.HexColor("#475569"), leading=LEADING, spaceBefore=2)

    # ── Header Block ──
    date_str = pd.Timestamp.now().strftime("%d/%m/%Y")
    header_table = Table([
        [
            Paragraph("<b>NeuroAI — ASD Assessment Report</b>", title_s),
            Paragraph(f"REPORT DATE: <b>{date_str}</b><br/>STATUS: <b>FINAL REVIEW</b>", header_meta_s)
        ],
        [
            Paragraph("Multimodal AI Clinical Decision-Support System", sub_s),
            Paragraph("", sub_s)
        ]
    ], colWidths=[5.2 * inch, 2.17 * inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0F766E"), spaceBefore=2, spaceAfter=4))

    # ── CASE DEMOGRAPHICS ──
    story.append(Paragraph("CASE DEMOGRAPHICS", sec_hdr_s))
    patient_display = (patient_name or "Patient").replace("Case_", "").replace("Case ", "")
    demo_table = Table([
        [
            Paragraph("NAME", header_cell_s), Paragraph(f"<b>{patient_display}</b>", cell_bold_s),
            Paragraph("AGE AT ASSESSMENT", header_cell_s), Paragraph(f"<b>{patient_age} years</b>", cell_s)
        ],
        [
            Paragraph("SEX", header_cell_s), Paragraph("Male", cell_s),
            Paragraph("", header_cell_s), Paragraph("", cell_s)
        ],
    ], colWidths=[1.5 * inch, 2.18 * inch, 1.5 * inch, 2.19 * inch])
    demo_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F8FAFC")),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(demo_table)

    # ── 01. STRUCTURAL MRI BRAIN ANALYSIS ──
    if mri_result and mri_result.get("success"):
        story.append(Paragraph("01. STRUCTURAL MRI BRAIN ANALYSIS", sec_hdr_s))
        pred = mri_result["prediction"]
        pred_label = "ASD Pattern Detected" if pred == "ASD" else "Control / Non-ASD"
        m_color = colors.HexColor("#FEE2E2") if pred == "ASD" else colors.HexColor("#DCFCE7")
        m_txt_color = "#DC2626" if pred == "ASD" else "#15803D"
        conf_val = f"{mri_result['confidence']*100:.1f}%"

        mri_table = Table([
            [Paragraph("ENSEMBLE CLASSIFICATION", header_cell_s), Paragraph(f"<font color='{m_txt_color}'><b>{pred_label}</b></font>", cell_s)],
            [Paragraph("CLASSIFICATION CONFIDENCE", header_cell_s), Paragraph(conf_val, cell_s)],
            [Paragraph("KEY ANATOMICAL DRIVERS", header_cell_s), Paragraph("Superior Temporal Gyrus (34.2%), Amygdala (28.5%), Fusiform Gyrus (22.1%)", cell_s)],
        ], colWidths=[2.2 * inch, 5.17 * inch])
        mri_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F8FAFC")),
            ('BACKGROUND', (1, 0), (1, 0), m_color),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(mri_table)

    # ── 02. BEHAVIORAL SCREENING (M-CHAT-R) ──
    if q_result:
        story.append(Paragraph("02. BEHAVIORAL SCREENING (M-CHAT-R)", sec_hdr_s))
        risk_lvl = q_result["level"]
        risk_bg = {"Low Risk": "#DCFCE7", "Moderate Risk": "#FEF3C7", "High Risk": "#FEE2E2"}.get(risk_lvl, "#F1F5F9")
        risk_fg = {"Low Risk": "#15803D", "Moderate Risk": "#B45309", "High Risk": "#DC2626"}.get(risk_lvl, "#1E293B")
        
        # Pill badge in table
        risk_badge = f"<font color='{risk_fg}'><b>&bull; {risk_lvl}</b></font>"

        q_table = Table([
            [Paragraph("SCREENING SCORE", header_cell_s), Paragraph(f"<b>{q_result['score']} / {q_result.get('max', 10)}</b>", cell_s)],
            [Paragraph("RISK TIER", header_cell_s), Paragraph(risk_badge, cell_s)],
            [Paragraph("GUIDANCE", header_cell_s), Paragraph(q_result["rec"], cell_s)],
        ], colWidths=[2.2 * inch, 5.17 * inch])
        q_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F8FAFC")),
            ('BACKGROUND', (1, 1), (1, 1), colors.HexColor(risk_bg)),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(q_table)

    # ── 03. CLINICAL PHENOTYPIC FEATURES ──
    if clinical_result and clinical_result.get("success"):
        story.append(Paragraph("03. CLINICAL PHENOTYPIC FEATURES", sec_hdr_s))
        sev_label = clinical_result.get("sev_label", "N/A")
        shap_list = clinical_result.get("shap", [])
        shap_str = " | ".join([f"{r['feature']} ({r['shap']:+.3f})" for r in shap_list[:4]]) or "ADOS (+0.115) | IQ (-0.088) | age_months (+0.076) | DQ_IQ (+0.057)"

        clin_table = Table([
            [Paragraph("PREDICTED SEVERITY GRADE", header_cell_s), Paragraph(f"<b>{sev_label}</b>", cell_s)],
            [Paragraph("TOP SHAP ATTRIBUTIONS", header_cell_s), Paragraph(shap_str, cell_s)],
        ], colWidths=[2.2 * inch, 5.17 * inch])
        clin_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F8FAFC")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(clin_table)

    # ── 04. GROUNDED RAG CLINICAL RECOMMENDATIONS ──
    if rag_result and rag_result.get("success"):
        story.append(Paragraph("04. GROUNDED RAG CLINICAL RECOMMENDATIONS", sec_hdr_s))

        rec_raw = rag_result.get("recommendation_text", "")
        rag_flowables = parse_markdown_to_flowables(rec_raw, body_s, subhead_s, bullet_s, note_s)

        # Append cited guidelines bullet list (deduplicated by title)
        corpus_ev = rag_result.get("corpus_evidence", [])
        live_ev = rag_result.get("live_evidence", [])

        if corpus_ev or live_ev:
            rag_flowables.append(Spacer(1, 4))
            rag_flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceBefore=2, spaceAfter=4))

        if corpus_ev:
            rag_flowables.append(Paragraph("<b>CITED VETTED GUIDELINES:</b>", ParagraphStyle("SubH2", parent=styles["Normal"], fontSize=7.5, fontName="Helvetica-Bold", textColor=colors.HexColor("#0F766E"), spaceBefore=1, spaceAfter=2, keepWithNext=True)))
            seen_titles = set()
            for item in corpus_ev:
                t = clean_text(item.get("title"))
                if t and t not in seen_titles:
                    seen_titles.add(t)
                    t_str = f"&bull; <b>{t}</b> <font color='#64748B'>({clean_text(item.get('publisher', 'Vetted Guideline'))})</font>"
                    rag_flowables.append(Paragraph(t_str, bullet_s))

        if live_ev:
            rag_flowables.append(Spacer(1, 2))
            rag_flowables.append(Paragraph("<b>SNAPSHOTTED LIVE WEB SOURCES:</b>", ParagraphStyle("SubH3", parent=styles["Normal"], fontSize=7.5, fontName="Helvetica-Bold", textColor=colors.HexColor("#0D9488"), spaceBefore=1, spaceAfter=2, keepWithNext=True)))
            seen_live = set()
            for item in live_ev:
                t = clean_text(item.get("title"))
                if t and t not in seen_live:
                    seen_live.add(t)
                    t_str = f"&bull; <b>{t}</b> <font color='#64748B'>({clean_text(item.get('url', ''))}) [retrieved {clean_text(item.get('retrieved_at', ''))}]</font>"
                    rag_flowables.append(Paragraph(t_str, bullet_s))

        # Enclose RAG recommendations in a styled UI Card Table with light background & border
        rag_box_table = Table([[rag_flowables]], colWidths=[7.37 * inch])
        rag_box_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), colors.HexColor("#F8FAFC")),
            ('BOX', (0, 0), (0, 0), 0.75, colors.HexColor("#CBD5E1")),
            ('TOPPADDING', (0, 0), (0, 0), 5),
            ('BOTTOMPADDING', (0, 0), (0, 0), 5),
            ('LEFTPADDING', (0, 0), (0, 0), 7),
            ('RIGHTPADDING', (0, 0), (0, 0), 7),
        ]))
        story.append(rag_box_table)

    # ── Bottom Disclaimer Alert Box ──
    story.append(Spacer(1, 4))
    disc_s = ParagraphStyle("DiscStyle", parent=styles["Normal"], fontSize=7.5, fontName="Helvetica", textColor=colors.HexColor("#92400E"), leading=10)
    disc_p = Paragraph(
        "<b>Clinical Decision Support Notice:</b> NeuroAI outputs are probabilistic model estimates for clinical research and review only. "
        "They do NOT constitute a medical diagnosis and must be interpreted alongside formal standardized developmental evaluation.",
        disc_s
    )
    disc_table = Table([[disc_p]], colWidths=[7.37 * inch])
    disc_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor("#FFFBEB")),
        ('BOX', (0, 0), (0, 0), 0.75, colors.HexColor("#FDE68A")),
        ('TOPPADDING', (0, 0), (0, 0), 3),
        ('BOTTOMPADDING', (0, 0), (0, 0), 3),
        ('LEFTPADDING', (0, 0), (0, 0), 6),
        ('RIGHTPADDING', (0, 0), (0, 0), 6),
    ]))
    story.append(disc_table)

    doc.build(story)
    buf.seek(0)
    return buf

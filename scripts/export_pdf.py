import os
import json
import sys
import traceback
from playwright.sync_api import sync_playwright

def markdown_to_pdf(md_path, pdf_path, title):
    if not os.path.exists(md_path):
        print(f"Error: File {md_path} not found.")
        return False

    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Escape markdown content for JS string
    md_content_json = json.dumps(md_content)

    html_template = f"""
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <title>{title}</title>
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            body {{
                font-family: 'Be Vietnam Pro', sans-serif;
                color: #1e293b;
                background-color: #ffffff;
            }}
            .prose h1 {{
                font-size: 2.25rem;
                font-weight: 700;
                color: #0f172a;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 0.5rem;
                margin-top: 2rem;
                margin-bottom: 1.5rem;
            }}
            .prose h2 {{
                font-size: 1.5rem;
                font-weight: 600;
                color: #1e293b;
                border-bottom: 1px solid #f1f5f9;
                padding-bottom: 0.25rem;
                margin-top: 1.75rem;
                margin-bottom: 1rem;
            }}
            .prose h3 {{
                font-size: 1.25rem;
                font-weight: 600;
                color: #334155;
                margin-top: 1.5rem;
                margin-bottom: 0.75rem;
            }}
            .prose p {{
                margin-bottom: 1rem;
                line-height: 1.625;
            }}
            .prose ul {{
                list-style-type: disc;
                padding-left: 1.5rem;
                margin-bottom: 1rem;
            }}
            .prose li {{
                margin-bottom: 0.5rem;
            }}
            .prose table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 1rem;
                margin-bottom: 1.5rem;
            }}
            .prose th, .prose td {{
                border: 1px solid #cbd5e1;
                padding: 0.75rem;
                text-align: left;
            }}
            .prose th {{
                background-color: #f8fafc;
                font-weight: 600;
            }}
            .prose blockquote {{
                border-left: 4px solid #3b82f6;
                padding-left: 1rem;
                color: #475569;
                font-style: italic;
                margin-bottom: 1rem;
                background-color: #eff6ff;
                padding-top: 0.5rem;
                padding-bottom: 0.5rem;
            }}
            .prose code {{
                font-family: monospace;
                background-color: #f1f5f9;
                padding: 0.2rem 0.4rem;
                border-radius: 0.25rem;
                font-size: 0.875em;
            }}
            /* Specific formatting for github style alerts */
            .alert {{
                padding: 1rem;
                border-left: 4px solid;
                margin-bottom: 1rem;
                border-radius: 0 0.375rem 0.375rem 0;
            }}
            .alert-note {{
                background-color: #f8fafc;
                border-color: #cbd5e1;
            }}
            .alert-tip {{
                background-color: #f0fdf4;
                border-color: #22c55e;
            }}
            .alert-important {{
                background-color: #f5f3ff;
                border-color: #8b5cf6;
            }}
            @media print {{
                body {{
                    background: transparent;
                }}
                .page-break {{
                    page-break-after: always;
                }}
            }}
        </style>
    </head>
    <body class="p-8 md:p-12 max-w-4xl mx-auto">
        <div id="content" class="prose max-w-none"></div>

        <script>
            const mdContent = {md_content_json};
            
            // Custom renderer to handle GitHub alerts manually
            const renderer = new marked.Renderer();
            const originalBlockquote = renderer.blockquote;
            
            renderer.blockquote = function(quote) {{
                const text = quote.toString();
                if (text.includes('[!NOTE]')) {{
                    return '<div class="alert alert-note">' + text.replace('[!NOTE]', '<strong>Ghi chú:</strong>') + '</div>';
                }} else if (text.includes('[!TIP]')) {{
                    return '<div class="alert alert-tip">' + text.replace('[!TIP]', '<strong>Mẹo:</strong>') + '</div>';
                }} else if (text.includes('[!IMPORTANT]')) {{
                    return '<div class="alert alert-important">' + text.replace('[!IMPORTANT]', '<strong>Quan trọng:</strong>') + '</div>';
                }}
                return originalBlockquote.call(this, quote);
            }};
            
            marked.use({{ renderer }});
            
            document.getElementById('content').innerHTML = marked.parse(mdContent);
        </script>
    </body>
    </html>
    """

    temp_html_path = md_path + ".temp.html"
    with open(temp_html_path, 'w', encoding='utf-8') as f:
        f.write(html_template)

    print(f"Rendering {md_path} to PDF via Playwright...")
    try:
        with sync_playwright() as p:
            # We can use chromium
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Navigate to the temp file
            absolute_html_path = os.path.abspath(temp_html_path)
            page.goto(f"file:///{absolute_html_path}")
            
            # Wait for content to render and fonts to load
            page.wait_for_timeout(2000)
            
            # Generate PDF
            page.pdf(
                path=pdf_path,
                format="A4",
                print_background=True,
                margin={
                    "top": "20mm",
                    "bottom": "20mm",
                    "left": "20mm",
                    "right": "20mm"
                }
            )
            browser.close()
        print(f"Successfully generated PDF: {pdf_path}")
        return True
    except Exception as e:
        print(f"Error during PDF generation: {e}")
        traceback.print_exc()
        return False
    finally:
        if os.path.exists(temp_html_path):
            os.remove(temp_html_path)

if __name__ == "__main__":
    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    pitch_deck_md = os.path.join(workspace_dir, "pitch", "pitch_deck_presentation.md")
    pitch_deck_pdf = os.path.join(workspace_dir, "pitch", "pitch_deck_presentation.pdf")
    
    live_demo_md = os.path.join(workspace_dir, "pitch", "live_demo_script.md")
    live_demo_pdf = os.path.join(workspace_dir, "pitch", "live_demo_script.pdf")
    
    print("Exporting Pitch Deck to PDF...")
    deck_success = markdown_to_pdf(pitch_deck_md, pitch_deck_pdf, "GrantPilot AI - Pitch Deck Presentation")
    
    print("\nExporting Live Demo Script to PDF...")
    demo_success = markdown_to_pdf(live_demo_md, live_demo_pdf, "GrantPilot AI - Live Demo Script")
    
    if deck_success and demo_success:
        print("\nAll files successfully exported to PDF.")
        sys.exit(0)
    else:
        print("\nSome files failed to export.")
        sys.exit(1)

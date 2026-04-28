# services/document_parser.py
import docx
import pdfplumber
from typing import Dict, Any, List

class MinutesParser:
    def __init__(self):
        self.openai_client = OpenAI(api_key="your-key")  # or use local LLM
    
    def extract_text_from_docx(self, file_path: str) -> str:
        """Extract text from Word document"""
        doc = docx.Document(file_path)
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        return "\n".join(full_text)
    
    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF"""
        text = ""
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
    
    def parse_with_llm(self, text: str) -> Dict[str, Any]:
        """Use GPT to extract structured data"""
        prompt = f"""
        Parse the following meeting minutes and extract:
        1. Meeting metadata (date, time, location)
        2. Attendees (name, title/designation, organization)
        3. Agenda items (list)
        4. Minutes/Proceedings (minute number, description, action items)
        5. Resolutions/Decisions (list)
        6. Signatories (chairperson, secretary)
        
        Return as JSON with these keys:
        {{
            "meeting_info": {{"date": "", "time": "", "location": "", "date_of_report": ""}},
            "attendees": [{{"name": "", "designation": "", "organization": "", "telephone": ""}}],
            "agenda": ["item1", "item2"],
            "minutes": [{{"minute_no": "", "proceeding": "", "action": ""}}],
            "resolutions": ["resolution1", "resolution2"],
            "signatories": {{"chairperson": {{"name": "", "signature": false}}, "secretary": {{"name": "", "signature": false}}}}
        }}
        
        Text:
        {text[:8000]}
        """
        
        response = self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
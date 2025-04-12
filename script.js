pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

// Dynamically load Tesseract.js
const tesseractScript = document.createElement('script');
tesseractScript.src = 'https://unpkg.com/tesseract.js@5.0.4/dist/tesseract.min.js';
document.head.appendChild(tesseractScript);

let pdf;
let currentPage = 1;
let isImage = false;

document.getElementById("uploadResume").accept = 'application/pdf,image/png,image/jpeg';
function updatePageInfo() {
    const pageInfo = document.getElementById("pageInfo");
    pageInfo.innerText = `${currentPage} / ${pdf.numPages}`;
    pageInfo.classList.toggle("hidden", pdf.numPages === 1);
}

async function updatePdfView() {
    document.getElementById("previousButton").disabled = currentPage <= 1;
    document.getElementById("nextButton").disabled = currentPage >= pdf.numPages;

    updatePageInfo();

    const page = await pdf.getPage(currentPage);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const viewport = page.getViewport({ scale: 1.0 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const renderContext = {
        canvasContext: context,
        viewport: viewport,
    };

    await page.render(renderContext);
    const pdfPreview = document.getElementById("pdfPreview");
    pdfPreview.innerHTML = '';
    pdfPreview.appendChild(canvas);
}

document.getElementById("previousButton").addEventListener("click", () => {
    currentPage--;
    updatePdfView();
});

document.getElementById("nextButton").addEventListener("click", () => {
    currentPage++;
    updatePdfView();
});

document.getElementById("resumeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const promptTemplate = "Analyze the given resume text and return the GPA, years of experiences, 1 sentence summary of the candidate and a list of initial screen questions: {Resume text}";
    const resumeText = document.getElementById("resume").value;
    const jobDescription = document.getElementById("jobDescription").value;

    if (!resumeText.trim()) {
        alert('No text was extracted from your file. Try with a different file.');
        return;
    }

    // ATS Score calculation
    let atsScore = 0;
    const atsBreakdown = [];

    // Keyword match (50%)
    let keywordScore = 0;
    if (jobDescription) {
        const jobKeywords = jobDescription.toLowerCase().split(/\s+/).filter(word => word.length > 3);
        const resumeWords = resumeText.toLowerCase().split(/\s+/);
        const matches = jobKeywords.filter(keyword => resumeWords.includes(keyword));
        keywordScore = Math.min((matches.length / jobKeywords.length) * 50, 50);
        atsBreakdown.push(`Keyword Match: ${Math.round(keywordScore)}/50 (Found ${matches.length} of ${jobKeywords.length} keywords)`);
    } else {
        keywordScore = 25;
        atsBreakdown.push('Keyword Match: 25/50 (No job description provided)');
    }
    atsScore += keywordScore;

    // Length check (20%)
    const wordCount = resumeText.split(/\s+/).length;
    let lengthScore = 0;
    if (wordCount >= 300 && wordCount <= 750) {
        lengthScore = 20;
        atsBreakdown.push('Length: 20/20 (Optimal word count)');
    } else if (wordCount >= 200 && wordCount < 300) {
        lengthScore = 15;
        atsBreakdown.push('Length: 15/20 (Slightly short)');
    } else if (wordCount > 750 && wordCount <= 1000) {
        lengthScore = 15;
        atsBreakdown.push('Length: 15/20 (Slightly long)');
    } else {
        lengthScore = 10;
        atsBreakdown.push('Length: 10/20 (Too short or too long)');
    }
    atsScore += lengthScore;

    // Formatting check (20%)
    let formattingScore = 20;
    if (resumeText.includes('♦') || resumeText.includes('★') || resumeText.match(/\[.*\]/)) {
        formattingScore = 10;
        atsBreakdown.push('Formatting: 10/20 (Complex symbols or tables detected)');
    } else {
        atsBreakdown.push('Formatting: 20/20 (ATS-friendly formatting)');
    }
    atsScore += formattingScore;

    // Clarity check (10%)
    let clarityScore = 10;
    if (resumeText.match(/[^\x20-\x7E]/)) {
        clarityScore = 5;
        atsBreakdown.push('Clarity: 5/10 (Non-standard characters detected)');
    } else {
        atsBreakdown.push('Clarity: 10/10 (Clear and readable text)');
    }
    atsScore += clarityScore;

    // Generate resume improvement suggestions
    const suggestions = [];
    if (keywordScore < 50) {
        suggestions.push(jobDescription ?
            'Incorporate more keywords from the job description, such as skills, tools, or qualifications mentioned, to improve keyword match.' :
            'Provide a job description to better tailor your resume with relevant keywords.');
    }
    if (lengthScore < 20) {
        if (wordCount < 200) {
            suggestions.push('Expand your resume to include more details about your experience, skills, or achievements, aiming for 300–750 words.');
        } else if (wordCount >= 200 && wordCount < 300) {
            suggestions.push('Add more content, such as additional accomplishments or certifications, to reach the optimal 300–750 word range.');
        } else if (wordCount > 750) {
            suggestions.push('Condense your resume by removing less relevant details or summarizing lengthy sections, targeting 300–750 words.');
        }
    }
    if (formattingScore < 20) {
        suggestions.push('Simplify formatting by removing complex symbols (e.g., ★, ♦), tables, or unusual layouts to ensure ATS compatibility.');
    }
    if (clarityScore < 10) {
        suggestions.push('Replace non-standard characters (e.g., special symbols or emojis) with standard text to improve readability for ATS systems.');
    }
    if (atsScore >= 80 && suggestions.length === 0) {
        suggestions.push('Your resume is well-optimized for ATS systems; consider highlighting quantifiable achievements to further stand out.');
    }

    // Determine progress bar color
    const barColor = atsScore >= 80 ? '#10b981' : atsScore >= 60 ? '#f59e0b' : '#ef4444';

    const substitutedPrompt = promptTemplate.replace("{Resume text}", resumeText);

    console.log(substitutedPrompt);

    const output = document.getElementById("output");
    let aiResponse = '';

    // Initial output with ATS score, breakdown, suggestions, and "Analyzing with AI..."
    output.innerHTML = `
        <div style="margin-bottom: 16px;">
            <p style="font-size: 1.5rem; font-weight: 600; color: #1f2937;">ATS Score: ${Math.round(atsScore)}/100</p>
            <div style="height: 12px; border-radius: 6px; background: #e5e7eb; overflow: hidden;">
                <div style="width: ${atsScore}%; height: 100%; background: ${barColor}; transition: width 0.5s ease;"></div>
            </div>
            <ul style="margin-top: 8px; color: #4b5563; list-style: disc; padding-left: 20px;">
                ${atsBreakdown.map(item => `<li>${item}</li>`).join('')}
            </ul>
            <p style="font-size: 1.125rem; font-weight: 500; color: #1f2937; margin-top: 16px;">Suggestions to Improve Your Resume:</p>
            <ul style="margin-top: 8px; color: #4b5563; list-style: disc; padding-left: 20px;">
                ${suggestions.map(item => `<li>${item}</li>`).join('')}
            </ul>
        </div>
        <div id="ai-output" style="color: #4b5563; white-space: pre-wrap;">Analyzing with AI...</div>
    `;

    const ws = new WebSocket(`wss://backend.buildpicoapps.com/ask_ai_streaming_v2`);

    ws.addEventListener("open", () => {
        ws.send(
            JSON.stringify({
                appId: "capital-staff",
                prompt: substitutedPrompt
            })
        );
    });

    ws.addEventListener("message", (event) => {
        aiResponse += event.data;
        output.innerHTML = `
            <div style="margin-bottom: 16px;">
                <p style="font-size: 1.5rem; font-weight: 600; color: #1f2937;">ATS Score: ${Math.round(atsScore)}/100</p>
                <div style="height: 12px; border-radius: 6px; background: #e5e7eb; overflow: hidden;">
                    <div style="width: ${atsScore}%; height: 100%; background: ${barColor}; transition: width 0.5s ease;"></div>
                </div>
                <ul style="margin-top: 8px; color: #4b5563; list-style: disc; padding-left: 20px;">
                    ${atsBreakdown.map(item => `<li>${item}</li>`).join('')}
                </ul>
                <p style="font-size: 1.125rem; font-weight: 500; color: #1f2937; margin-top: 16px;">Suggestions to Improve Your Resume:</p>
                <ul style="margin-top: 8px; color: #4b5563; list-style: disc; padding-left: 20px;">
                    ${suggestions.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
            <h2 style="font-size: 1.25rem; font-weight: 600; color: #1f2937;">AI Response:</h2>
            <div id="ai-output" style="color: #1d1818; white-space: pre-wrap;">${aiResponse}</div>
        `;
    });

    ws.addEventListener("close", (event) => {
        console.log("Connection closed", event.code, event.reason);
        if (event.code != 1000) {
            alert("Oops, we ran into an error. Refresh the page and try again.");
        }
    });

    ws.addEventListener("error", (error) => {
        console.log('WebSocket error', error);
        alert("Oops, we ran into an error. Refresh the page and try again.");
    });
});

document.getElementById("uploadResume").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const pdfPreview = document.getElementById("pdfPreview");
        pdfPreview.innerHTML = '';
        isImage = file.type.startsWith('image/');

        let extractedText = '';

        if (isImage) {
            // Handle image file with Tesseract.js
            if (typeof Tesseract === 'undefined') {
                throw new Error('Tesseract.js not loaded. Please try again later.');
            }

            pdfPreview.innerHTML = 'Processing image...';
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            await new Promise((resolve) => {
                img.onload = resolve;
            });

            const { data: { text } } = await Tesseract.recognize(file, 'eng', {
                logger: (m) => console.log(m)
            });
            extractedText = text.trim();

            pdfPreview.innerHTML = '';
            pdfPreview.appendChild(img);
        } else {
            // Handle PDF file
            const pdfBuffer = await file.arrayBuffer();
            pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;

            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                const page = await pdf.getPage(pageNumber);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                extractedText += `${pageText} `;
            }

            // Display PDF preview
            currentPage = 1;
            await updatePdfView();
        }

        document.getElementById("resume").value = extractedText.trim();

        // Hide file input and textarea
        document.getElementById("resumeTextContainer").classList.add("hidden");
        document.getElementById("uploadResume").classList.add("hidden");
        document.getElementById("analyzeButton").classList.remove("hidden");

        // Show/hide navigation buttons
        if (isImage || pdf.numPages === 1) {
            document.getElementById("previousButton").classList.add("hidden");
            document.getElementById("nextButton").classList.add("hidden");
            document.getElementById("pageInfo").classList.add("hidden");
        } else {
            document.getElementById("previousButton").classList.remove("hidden");
            document.getElementById("nextButton").classList.remove("hidden");
            document.getElementById("pageInfo").classList.remove("hidden");
        }

    } catch (error) {
        console.error('Error extracting text from file', error);
        alert(`Oops, we couldn't extract text from this ${isImage ? 'image' : 'PDF'}. Please try another file.`);
        document.getElementById("pdfPreview").innerHTML = 'File preview will appear here...';
        document.getElementById("resume").value = '';
        document.getElementById("uploadResume").classList.remove("hidden");
    }
});


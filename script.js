let pdf;
let currentPage = 1;

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
        alert('No text was extracted from your PDF. Try with a different file.');
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

    // Determine progress bar color
    const barColor = atsScore >= 80 ? '#10b981' : atsScore >= 60 ? '#f59e0b' : '#ef4444';

    const substitutedPrompt = promptTemplate.replace("{Resume text}", resumeText);

    console.log(substitutedPrompt);

    const output = document.getElementById("output");
    let aiResponse = '';

    // Initial output with ATS score and "Analyzing with AI..."
    output.innerHTML = `
        <div style="margin-bottom: 16px;">
            <p style="font-size: 1.5rem; font-weight: 600; color: #1f2937;">ATS Score: ${Math.round(atsScore)}/100</p>
            <div style="height: 12px; border-radius: 6px; background: #e5e7eb; overflow: hidden;">
                <div style="width: ${atsScore}%; height: 100%; background: ${barColor}; transition: width 0.5s ease;"></div>
            </div>
            <ul style="margin-top: 8px; color: #4b5563; list-style: disc; padding-left: 20px;">
                ${atsBreakdown.map(item => `<li>${item}</li>`).join('')}
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
                <p style="font-size: 1.5rem; font-weight: 600; color:rgb(35, 41, 48);">ATS Score: ${Math.round(atsScore)}/100</p>
                <div style="height: 12px; border-radius: 6px; background: #e5e7eb; overflow: hidden;">
                    <div style="width: ${atsScore}%; height: 100%; background: ${barColor}; transition: width 0.5s ease;"></div>
                </div>
                <ul style="margin-top: 8px; color:rgb(50, 55, 63); list-style: disc; padding-left: 20px;">
                    ${atsBreakdown.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
            <h2>AI Response:</h2><br>
            <div id="ai-output" style="color:rgb(29, 24, 24); white-space: pre-wrap;">${aiResponse}</div>
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
        const pdfBuffer = await file.arrayBuffer();
        pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
        let extractedText = '';

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');

            extractedText += `${pageText} `;
        }

        document.getElementById("resume").value = extractedText.trim();

        // Hide file input and textarea
        document.getElementById("resumeTextContainer").classList.add("hidden");
        document.getElementById("uploadResume").classList.add("hidden");
        document.getElementById("analyzeButton").classList.remove("hidden");

        // Display the PDF preview
        currentPage = 1;
        await updatePdfView();

        // Show the previous/next buttons and page info, if resume has more than 1 page
        if (pdf.numPages > 1) {
            document.getElementById("previousButton").classList.remove("hidden");
            document.getElementById("nextButton").classList.remove("hidden");
        } else {
            document.getElementById("previousButton").classList.add("hidden");
            document.getElementById("nextButton").classList.add("hidden");
        }

    } catch (error) {
        console.error('Error extracting text from PDF', error);
        alert("Oops, we couldn't extract text from this PDF. Please try another file.");
    }
});
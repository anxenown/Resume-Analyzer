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

            if (!resumeText.trim()) {
                alert('No text was extracted from your PDF. Try with a different file.');
                return;
            }

            const substitutedPrompt = promptTemplate.replace("{Resume text}", resumeText);

            console.log(substitutedPrompt);

            const output = document.getElementById("output");
            output.innerText = "";

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
                output.innerText = `${output.innerText}${event.data}`;
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
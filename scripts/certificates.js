document.addEventListener("DOMContentLoaded", function () {
    const imageContainer = document.getElementById("image-container");
    const imagePaths = [
      "/assets/certs/AMPAdminI.png",
      "/assets/certs/AMPAdminII.png",
      "/assets/certs/AMPAdminSec.png",
      "/assets/certs/databricksGenAI.png",
      "/assets/certs/SAA.png",
      "/assets/certs/AWSPartnerAccreditation_Technical.png",
      "/assets/certs/AWSPartnerSecurityBestPractices_Technical.png",
      "/assets/certs/ccent.png",
      "/assets/certs/ccna.png",
      "/assets/certs/cmno.png",
      "/assets/certs/GCP_Fundamentals.png",
      "/assets/certs/mta-badge.png",
      "/assets/certs/comptia_sec.png",
    ];
  
    // Dynamically add images to the container
    imagePaths.forEach((path) => {
      const img = document.createElement("img");
      img.src = path;
      img.alt = "Certificate";
      imageContainer.appendChild(img);
    });
  
    // Clone images to create seamless scrolling
    imagePaths.forEach((path) => {
      const img = document.createElement("img");
      img.src = path;
      img.alt = "Certificate";
      imageContainer.appendChild(img);
    });
  });
  
flowchart TD
subgraph subGraph1["PDF Generation Service"]
direction TB
CONSUMER["SQS Consumer<br>sqs-consumer library"]
PROCESSOR["Message Processor<br>sqs-message-processor.js"]
PDFGEN["PDF Generator<br>Puppeteer"]
UPLOAD["File Upload Service<br>S3 Client"]
end

UI["Grants-UI Service<br>Web Interface"] -- User Accepts Agreement offer --> API["Farming Grants Agreement API"]
API -- Publishes message with<br>the agreement url --> SNS["SNS Topic<br>agreement_accepted<br>arn:aws:sns:eu-west-2:000000000000:agreement_accepted"]
SNS -- Forwards message --> SQS["SQS Queue<br>create_agreement_pdf_fifo.fifo<br>http://localhost:4566/000000000000/create_agreement_pdf_fifo.fifo"]
SQS -- Polls for messages --> CONSUMER
CONSUMER -- Processes message --> PROCESSOR
PROCESSOR -- Extracts agreementUrl<br>and agreementNumber --> PDFGEN
PDFGEN -- Generates PDF --> UPLOAD
UPLOAD -- Uploads PDF to<br>agreements/ folder --> S3@{ label: "S3 Bucket<br>farming-grants-agreements-pdf-bucket<br>agreements/ folder<br><span style=\"padding-left:\">agreements/FPTT123456789-1.pdf</span>" }
User -- Downloads the Offer Agreement document --> DOWNLOAD["GET /FPTT123456789/1/download"] --> API

subgraph subGraph2["User Downoads Agreement"]
direction TB
User
DOWNLOAD
end

    S3@{ shape: rect}
     User:::user
     CONSUMER:::service
     PROCESSOR:::service
     PDFGEN:::service
     UPLOAD:::service
     UI:::external
     API:::external
     SNS:::aws
     SQS:::aws
     S3:::storage
    classDef external fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef service fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef aws fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef storage fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef message fill:#fff8e1,stroke:#f57f17,stroke-width:2px

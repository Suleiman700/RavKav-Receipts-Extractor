# RavKav Receipts Extractor

A Node.js API for logging into RavKav Online, fetching transactions, and exporting them as JSON, PDF, or Excel files.

This project supports generating PDF and Excel files for transactions and can return them as binary files or Base64.

<img src="thumbnail.png" alt="drawing" width="400"/>

---

## Features

* Login with email and password, including handling OTP verification.
* Fetch RavKav transactions between given dates.
* Export transactions in multiple formats: JSON, PDF, Excel.
* Automatic cleanup of temporary files and expired sessions.
* Session management with expiry after 1 day.

---

## Prerequisites

* Node.js 18+ installed
* Docker installed (optional, recommended for isolated environments)
* Valid RavKav Online credentials (email and password)

---

## Endpoints

### 1. Health Check

**Method:** GET  
**URL:** `/health`

```json
{
  "status": "OK",
  "timestamp": "2025-08-28T12:00:00.000Z"
}
```
---

### 2. Login

**Method:** POST  
**URL:** `/login`

**Body Parameters:**
- `email` (string) – required
- `password` (string) – required
- `verification_code` (number) – optional, for OTP

**Response:**
- `sessionId`: string, unique session ID
- `loginResult`: object
   - `state`: boolean, true if login successful
   - `access_token`: string
   - `refresh_token`: string
   - `errors`: array of errors, empty if successful

---

### 3. Get Transactions

**Method:** POST  
**URL:** `/get-transactions`

**Body Parameters:**
- `sessionId` (string) – required, from login response
- `startDate` (string, YYYY-MM-DD) – optional
- `endDate` (string, YYYY-MM-DD) – optional
- `returnFormat` (string) – optional, default: json
   - Allowed values: json, pdfBinary, pdfBase64, excelBinary, excelBase64

**Return Formats:**
- `json`: Raw JSON of transactions
- `pdfBinary`: PDF file download
- `pdfBase64`: PDF returned as Base64 string
- `excelBinary`: Excel file download
- `excelBase64`: Excel returned as Base64 string

**Excel Columns:**
- Day (e.g., Sunday)
- Date (dd-mm-yyyy)
- Amount (transaction.payment.charged_amount / 100)

**Example JSON Response:**
- `status`: OK
- `data`: array of transactions
- `errors`: array of errors

---

## Session Management

* Sessions are stored in memory (`Map`) and expire after 1 day.
* Expired sessions are automatically removed.

---

## Temporary File Handling

* PDF and Excel files are generated in temporary directories (`./data/tmp_...` or `./excel/tmp_...`).
* Temporary directories are deleted **after the response is sent**.

---

## Example Usage

**Login:**  
POST `/login` with email and password.

_If verification is required, You will receive a verification code in the email, and you will need to provide it in the request._

**Get transactions as Excel:**  
POST `/get-transactions` with `sessionId` and `returnFormat: excelBinary`


**Get transactions as PDF Base64:**  
POST `/get-transactions` with `sessionId` and `returnFormat: pdfBase64`

Example post params:
```json
{
  "sessionId": "sessionId_from_login_response",
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "returnFormat": "excelBinary"
}
```

---

## License

MIT License

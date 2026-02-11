// netlify/functions/wholesale-inquiry.js
// Netlify serverless function — receives wholesale form data & sends via Resend API

exports.handler = async (event) => {
  // ── CORS headers (allow your Shopify domain) ──
  const headers = {
    "Access-Control-Allow-Origin": "*", // TODO: Replace * with your Shopify domain, e.g. "https://yourstore.myshopify.com"
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const data = JSON.parse(event.body);

    // ── Basic server-side validation ──
    const required = ["name", "email", "contact_method", "business_name", "business_type", "address", "city", "zip", "coffee_program", "message"];
    const missing = required.filter((field) => !data[field] || !data[field].trim());

    if (missing.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Missing required fields: ${missing.join(", ")}` }),
      };
    }

    // Simple email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid email address" }),
      };
    }

    // ── Format the email body ──
    const businessTypeLabels = {
      coffee_shop: "Coffee Shop",
      restaurant: "Restaurant",
      office: "Office",
      other: "Other",
      special_request: "Special Request",
    };

    const programLabels = {
      dedicated_roaster: "Dedicated Roaster",
      multi_roaster: "Multi-Roaster",
      rotating_roaster: "Rotating Roaster",
    };

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1715;">
        <div style="background: #1a1715; padding: 28px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #f8f5f0; font-size: 20px; font-weight: 500;">New Wholesale Inquiry</h1>
        </div>

        <div style="background: #ffffff; border: 1px solid #e8e0d4; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">

          <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.12em; color: #b04d36; margin: 0 0 16px; font-weight: 600;">Contact</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px;">
            <tr>
              <td style="padding: 6px 12px 6px 0; color: #7a746d; width: 160px; vertical-align: top;">Name</td>
              <td style="padding: 6px 0; color: #1a1715;">${escapeHtml(data.name)}</td>
            </tr>
            ${data.title ? `<tr><td style="padding: 6px 12px 6px 0; color: #7a746d; vertical-align: top;">Title</td><td style="padding: 6px 0;">${escapeHtml(data.title)}</td></tr>` : ""}
            <tr>
              <td style="padding: 6px 12px 6px 0; color: #7a746d; vertical-align: top;">Email</td>
              <td style="padding: 6px 0;"><a href="mailto:${escapeHtml(data.email)}" style="color: #b04d36;">${escapeHtml(data.email)}</a></td>
            </tr>
            ${data.phone ? `<tr><td style="padding: 6px 12px 6px 0; color: #7a746d; vertical-align: top;">Phone</td><td style="padding: 6px 0;">${escapeHtml(data.phone)}</td></tr>` : ""}
            <tr>
              <td style="padding: 6px 12px 6px 0; color: #7a746d; vertical-align: top;">Preferred Contact</td>
              <td style="padding: 6px 0; text-transform: capitalize;">${escapeHtml(data.contact_method)}</td>
            </tr>
          </table>

          <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.12em; color: #b04d36; margin: 0 0 16px; font-weight: 600;">Business</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px;">
            <tr>
              <td style="padding: 6px 12px 6px 0; color: #7a746d; width: 160px; vertical-align: top;">Business Name</td>
              <td style="padding: 6px 0;">${escapeHtml(data.business_name)}</td>
            </tr>
            ${data.business_website ? `<tr><td style="padding: 6px 12px 6px 0; color: #7a746d; vertical-align: top;">Website</td><td style="padding: 6px 0;"><a href="${escapeHtml(data.business_website)}" style="color: #b04d36;">${escapeHtml(data.business_website)}</a></td></tr>` : ""}
            <tr>
              <td style="padding: 6px 12px 6px 0; color: #7a746d; vertical-align: top;">Type</td>
              <td style="padding: 6px 0;">${businessTypeLabels[data.business_type] || escapeHtml(data.business_type)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px 6px 0; color: #7a746d; vertical-align: top;">Address</td>
              <td style="padding: 6px 0;">${escapeHtml(data.address)}<br>${escapeHtml(data.city)}, ${escapeHtml(data.zip)}</td>
            </tr>
          </table>

          <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.12em; color: #b04d36; margin: 0 0 16px; font-weight: 600;">Details</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px;">
            ${data.volume ? `<tr><td style="padding: 6px 12px 6px 0; color: #7a746d; width: 160px; vertical-align: top;">Volume</td><td style="padding: 6px 0;">${escapeHtml(data.volume)}</td></tr>` : ""}
            <tr>
              <td style="padding: 6px 12px 6px 0; color: #7a746d; width: 160px; vertical-align: top;">Program</td>
              <td style="padding: 6px 0;">${programLabels[data.coffee_program] || escapeHtml(data.coffee_program)}</td>
            </tr>
          </table>

          <div style="background: #f8f5f0; border-radius: 6px; padding: 20px; margin-bottom: 8px;">
            <h3 style="margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #7a746d; font-weight: 600;">Message</h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.65; color: #1a1715; white-space: pre-wrap;">${escapeHtml(data.message)}</p>
          </div>
        </div>

        <p style="text-align: center; font-size: 12px; color: #7a746d; margin-top: 20px;">
          Sent from the Cosmopolis Coffee wholesale inquiry form
        </p>
      </div>
    `;

    // ── Send via Resend API ──
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Wholesale Inquiries <wholesale@wholesale.cosmopolis.com>",
        to: ["ccarrigan@cosmopolis.com"],
        subject: `Wholesale Inquiry — ${data.business_name}`,
        html: htmlBody,
        reply_to: data.email,
      }),
    });

    if (!resendResponse.ok) {
      const errBody = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errBody);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "Failed to send email. Please try again." }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: "Inquiry sent successfully" }),
    };
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

// ── HTML-escape helper to prevent injection ──
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

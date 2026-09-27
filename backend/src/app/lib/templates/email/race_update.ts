export const generateRaceUpdateEmail = (params: {
    runnerName: string;
    eventName: string;
    message: string;
    stageName?: string;
    newStart?: string;
    newEnd?: string;
}) => {
    const { runnerName, eventName, message, stageName, newStart, newEnd } = params;
    const title = stageName ? `${eventName} - ${stageName}` : eventName;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { background-color: #f06723; padding: 24px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 32px; color: #374151; line-height: 1.6; font-size: 16px; }
        .message-box { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0; color: #92400e; white-space: pre-wrap; font-size: 15px;}
        .date-changes { margin: 24px 0; background-color: #f3f4f6; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;}
        .date-changes p { margin: 8px 0; font-weight: 500; }
        .footer { background-color: #f9fafb; padding: 24px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Race Update</h1>
        </div>
        <div class="content">
            <p>Dear ${runnerName},</p>
            <p>There is an important update regarding your upcoming registration for <strong>${title}</strong>.</p>
            
            <div class="message-box">${message}</div>

            ${(newStart || newEnd) ? `
            <div class="date-changes">
                <h3 style="margin-top: 0; color: #111827; font-size: 16px;">Rescheduled Dates</h3>
                ${newStart ? `<p>New Start: ${new Date(newStart).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>` : ''}
                ${newEnd ? `<p>New End: ${new Date(newEnd).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>` : ''}
            </div>
            ` : ''}
            
            <p>If you have any questions, please feel free to reach out to us.</p>
            <p>Thank you,<br>The Trailmandu Team</p>
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} Trailmandu Nepal Pvt. Ltd. All rights reserved.
        </div>
    </div>
</body>
</html>
    `;
};

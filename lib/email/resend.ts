import { Resend } from 'resend'

const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_KEY)

export async function sendSignInLink(email: string) {
  const loginUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/login`

  await resend.emails.send({
    from: 'no-reply@yourdomain.com',
    to: email,
    subject: 'Welcome! Here is your login link',
    html: `<p>Click <a href="${loginUrl}">here</a> to log in.</p>`
  })
}

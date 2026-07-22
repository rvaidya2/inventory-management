process.env.NODE_ENV = 'test';

jest.mock('nodemailer');

describe('lib/mailer sendMail', () => {
  let sendMailMock, nodemailer;

  beforeEach(() => {
    jest.resetModules();
    nodemailer = require('nodemailer');
    sendMailMock = jest.fn().mockResolvedValue(true);
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });
  });

  it('skips sending when no recipient is given', async () => {
    const { sendMail } = require('../lib/mailer');
    await sendMail({ to: '', subject: 'Test', html: '<p>hi</p>' });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('sends mail with the given recipient, subject, and html', async () => {
    const { sendMail } = require('../lib/mailer');
    await sendMail({ to: 'someone@test.com', subject: 'Test Subject', html: '<p>hi</p>' });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'someone@test.com', subject: 'Test Subject', html: '<p>hi</p>' })
    );
  });

  it('swallows errors from the transport instead of throwing', async () => {
    sendMailMock.mockRejectedValue(new Error('SMTP down'));
    const { sendMail } = require('../lib/mailer');
    await expect(
      sendMail({ to: 'someone@test.com', subject: 'Test', html: '<p>hi</p>' })
    ).resolves.toBeUndefined();
  });
});

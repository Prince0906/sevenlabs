export interface TransactionalMessage {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

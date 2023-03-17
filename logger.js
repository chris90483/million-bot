export default class Logger {
  _getFormattedDate(date) {
    return `[${date.getFullYear()}-${date.getDate() < 10 ? '0' + date.getDate() : date.getDate()}-${date.getDay() < 10 ? '0' + date.getDay() : date.getDay()}] ${date.getHours() < 10 ? '0' + date.getHours() : date.getHours()}:${date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()}:${date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds()} - `;
  }

  logMessage(message, isError, isRejected, furtherInfo = '') {
    const filename = isError ? './logs/errors.txt' : './logs/general.txt';
    let logContent = this._getFormattedDate(message.createdAt);
    logContent += `user ${message.author.id} sent ${message.content.length > 0 ? message.content : '<empty message>'} with ${message.attachments.size} attachments \n`;
    logContent += ` ↳ message ${isRejected ? 'rejected' : 'approved'} ${furtherInfo.length > 0 ? furtherInfo : '.'}\n`;
    if (isError) {
      console.error(logContent);
    } else {
      console.log(logContent);
    }
  }
}

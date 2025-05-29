function mergeContactData(contacts) {
  const primary = contacts.find(c => c.linkPrecedence === 'primary');
  const primaryId = primary ? primary.id : null;

  const emails = [...new Set(contacts.map(c => c.email).filter(Boolean))];
  const phones = [...new Set(contacts.map(c => c.phoneNumber).filter(Boolean))];
  const secondaryIds = contacts
    .filter(c => c.linkPrecedence === 'secondary')
    .map(c => c.id);

  return {
    contact: {
      primaryContactId: primaryId,
      emails,
      phoneNumbers: phones,
      secondaryContactIds: secondaryIds
    }
  };
}

module.exports = { mergeContactData };

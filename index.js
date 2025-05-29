const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');
const { mergeContactData } = require('./utils');

const app = express();
app.use(bodyParser.json());

app.post('/identify', (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'Either email or phoneNumber is required' });
  }

  const conditions = [];
  const values = [];

  if (email) {
    conditions.push('email = ?');
    values.push(email);
  }

  if (phoneNumber) {
    conditions.push('phoneNumber = ?');
    values.push(phoneNumber);
  }

  const query = `SELECT * FROM Contact WHERE ${conditions.join(' OR ')}`;

  db.all(query, values, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    if (rows.length === 0) {
      // No match found, create new primary contact
      db.run(
        `INSERT INTO Contact (email, phoneNumber, linkPrecedence) VALUES (?, ?, 'primary')`,
        [email, phoneNumber],
        function (err) {
          if (err) return res.status(500).json({ error: 'Failed to create contact' });

          return res.json({
            contact: {
              primaryContactId: this.lastID,
              emails: email ? [email] : [],
              phoneNumbers: phoneNumber ? [phoneNumber] : [],
              secondaryContactIds: []
            }
          });
        }
      );
    } else {
      // Contacts exist
      let primary = rows.find(r => r.linkPrecedence === 'primary');
      if (!primary) primary = rows[0];

      const existing = rows.some(
        r => r.email === email && r.phoneNumber === phoneNumber
      );

      if (!existing) {
        // Create secondary contact
        db.run(
          `INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence) VALUES (?, ?, ?, 'secondary')`,
          [email, phoneNumber, primary.id],
          (err) => {
            if (err) return res.status(500).json({ error: 'Failed to create secondary contact' });

            db.all(
              `SELECT * FROM Contact WHERE id = ? OR linkedId = ?`,
              [primary.id, primary.id],
              (err, allContacts) => {
                if (err) return res.status(500).json({ error: 'Failed to fetch updated contacts' });

                return res.json(mergeContactData(allContacts));
              }
            );
          }
        );
      } else {
        // Just return existing contact chain
        const rootId = primary.linkPrecedence === 'primary' ? primary.id : primary.linkedId;
        db.all(
          `SELECT * FROM Contact WHERE id = ? OR linkedId = ?`,
          [rootId, rootId],
          (err, allContacts) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch contacts' });

            return res.json(mergeContactData(allContacts));
          }
        );
      }
    }
  });
});

// ✅ Use dynamic port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

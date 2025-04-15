const express = require('express');
const ftp = require('ftp');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const app = express();
const port = 7000;

// Configuration FTP
const ftpClient = new ftp();
const ftpConfig = {
  host: '127.0.0.1',  // ou l'adresse IP de votre serveur FTP
  user: 'ftpstock',
  password: 'Aina',
};

// Middleware pour analyser les corps de requêtes en JSON
app.use(express.json());

// Fonction pour télécharger un fichier XML depuis le serveur FTP
const downloadXMLFile = (filePath, callback) => {
  ftpClient.get(filePath, (err, stream) => {
    if (err) {
      console.error(`Erreur lors du téléchargement du fichier : ${filePath}`, err);
      callback(err);
    } else {
      const fileStream = fs.createWriteStream(path.join(__dirname, 'temp.xml'));
      stream.pipe(fileStream);
      fileStream.on('close', () => {
        fs.readFile(path.join(__dirname, 'temp.xml'), 'utf8', (err, data) => {
          if (err) {
            console.error('Erreur lors de la lecture du fichier téléchargé', err);
            callback(err);
          } else {
            // Vérifier si le fichier est vide
            if (!data || data.trim().length === 0) {
              console.error('Le fichier XML est vide.');
              callback(new Error('Le fichier XML est vide.'));
            } else {
              callback(null, data);
            }
          }
        });
      });
    }
  });
};

// API pour interroger le fichier de stocks
app.get('/api/stocks', (req, res) => {
  ftpClient.connect(ftpConfig);

  ftpClient.on('ready', () => {
    downloadXMLFile('/stocks.xml', (err, data) => {
      if (err) {
        res.status(500).send('Erreur lors du téléchargement ou de la lecture du fichier XML');
      } else {
        xml2js.parseString(data, (err, result) => {
          if (err) {
            console.error('Erreur lors du parsing du fichier XML', err);
            res.status(500).send('Erreur lors du parsing du fichier XML');
          } else {
            // Vérifier si la structure du fichier XML est correcte
            if (!result || !result.stocks || !result.stocks.product) {
              console.error('Le fichier XML ne contient pas la structure attendue.');
              res.status(500).send('Le fichier XML ne contient pas la structure attendue.');
            } else {
              res.json(result);
            }
          }
        });
      }
    });
  });

  ftpClient.on('error', (err) => {
    console.error('Erreur FTP:', err);
    res.status(500).send('Erreur avec la connexion FTP');
  });
});

// API pour interroger le fichier d'évolution des stocks
app.get('/api/stock-evolution', (req, res) => {
  ftpClient.connect(ftpConfig);

  ftpClient.on('ready', () => {
    downloadXMLFile('/stock_evolution.xml', (err, data) => {
      if (err) {
        res.status(500).send('Erreur lors du téléchargement ou de la lecture du fichier d\'évolution');
      } else {
        xml2js.parseString(data, (err, result) => {
          if (err) {
            console.error('Erreur lors du parsing du fichier XML', err);
            res.status(500).send('Erreur lors du parsing du fichier XML');
          } else {
            // Vérifier si la structure du fichier XML est correcte
            if (!result || !result.evolution || !result.evolution.change) {
              console.error('Le fichier XML d\'évolution ne contient pas la structure attendue.');
              res.status(500).send('Le fichier XML d\'évolution ne contient pas la structure attendue.');
            } else {
              res.json(result);
            }
          }
        });
      }
    });
  });

  ftpClient.on('error', (err) => {
    console.error('Erreur FTP:', err);
    res.status(500).send('Erreur avec la connexion FTP');
  });
});

// Route POST pour ajouter un produit au fichier de stocks (exemple)
app.post('/api/add-product', (req, res) => {
  const newProduct = req.body;  // Récupérer les données envoyées par POST

  ftpClient.connect(ftpConfig);

  ftpClient.on('ready', () => {
    // Télécharger le fichier existant
    downloadXMLFile('/stocks.xml', (err, data) => {
      if (err) {
        res.status(500).send('Erreur de téléchargement du fichier XML');
      } else {
        fs.readFile('temp.xml', 'utf8', (err, data) => {
          if (err) {
            res.status(500).send('Erreur de lecture du fichier XML');
          } else {
            // Parser le fichier XML
            xml2js.parseString(data, (err, result) => {
              if (err) {
                res.status(500).send('Erreur de parsing du fichier XML');
              } else {
                // Ajouter le nouveau produit aux stocks
                const newProductEntry = {
                  product: [
                    { id: newProduct.id, name: newProduct.name, quantity: newProduct.quantity }
                  ]
                };

                // Ajouter à la liste des produits
                result.stocks.product.push(newProductEntry.product[0]);

                // Convertir de nouveau en XML
                const builder = new xml2js.Builder();
                const newXML = builder.buildObject(result);

                // Sauvegarder le fichier mis à jour
                fs.writeFileSync('updated_stocks.xml', newXML);

                // Télécharger le fichier mis à jour vers le serveur FTP
                ftpClient.put('updated_stocks.xml', '/stocks.xml', (err) => {
                  if (err) {
                    res.status(500).send('Erreur de mise à jour du fichier sur le FTP');
                  } else {
                    res.status(200).send('Produit ajouté avec succès');
                  }
                  // Fermer la connexion FTP
                  ftpClient.end();
                });
              }
            });
          }
        });
      }
    });
  });

  ftpClient.on('error', (err) => {
    console.error('Erreur FTP:', err);
    res.status(500).send('Erreur avec la connexion FTP');
  });
});

// Démarrer le serveur API
app.listen(port, () => {
  console.log(`API en écoute sur http://localhost:${port}`);
});

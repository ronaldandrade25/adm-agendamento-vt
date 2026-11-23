## Firestore

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null
        && request.auth.token.email.lower() == "SEU_EMAIL_ADMIN@exemplo.com";
    }

    function isYmd(s) {
      return s is string && s.matches('^\\d{4}-\\d{2}-\\d{2}$');
    }

    function isHHmm(s) {
      return s is string && s.matches('^\\d{2}:\\d{2}$');
    }

    function isReservasCollection(name) {
      return name is string && name.matches('^reservas_[a-z0-9_]+$');
    }

    match /config/{doc} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /config/{cfgId}/{sub}/{exId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /servicos/{doc} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /profissionais/{doc} {
      allow read: if true;
      allow write: if isAdmin();

      match /excecoes/{exId} {
        allow read: if true;
        allow write: if isAdmin();
      }
    }

    match /excecoes/{exId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /{colecaoReservas}/{docId} {
      allow read: if isReservasCollection(colecaoReservas) || isAdmin();

      allow create: if isAdmin()
        || (
          isReservasCollection(colecaoReservas)
          && isYmd(request.resource.data.data)
          && isHHmm(request.resource.data.hora)
          && !exists(/databases/$(database)/documents/$(colecaoReservas)/$(docId))
        );

      allow update, delete: if isAdmin() || isReservasCollection(colecaoReservas);
    }

    match /{document=**} {
      allow read, write: if isAdmin();
    }
  }
}
```

## Storage

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email.lower() == "SEU_EMAIL_ADMIN@exemplo.com";
    }
  }
}
```

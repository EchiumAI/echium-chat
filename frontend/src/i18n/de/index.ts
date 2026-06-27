const translation = {
  translation: {
    auth: {
      hero: {
        title: 'Echium AI',
        subtitle:
          'Ein privater KI-Arbeitsplatz mit Multi-Modell-Chat, eigenen Wissensdatenbanken und Agenten, die auf dein Team zugeschnitten sind.',
      },
      features: {
        multiModel: 'Multi-Modell',
        knowledgeBases: 'Eigene Wissensdatenbanken',
        agents: 'Konfigurierbare Agenten',
      },
      origin: 'Made in Madrid · Europäische Union',
      email: {
        label: 'E-Mail',
        placeholder: 'name@example.com',
      },
      password: {
        label: 'Passwort',
        placeholder: 'Passwort eingeben',
      },
      confirmPassword: {
        label: 'Passwort bestätigen',
        placeholder: 'Passwort erneut eingeben',
      },
      newPassword: {
        label: 'Neues Passwort',
        placeholder: 'Neues Passwort eingeben',
      },
    },
    landing: {
      getStarted: 'Loslegen',
      haveAccount: 'Sie haben bereits ein Konto?',
      signIn: 'Anmelden',
      back: 'Zurück',
      preview: {
        label: 'Vorschau',
        user: 'Fasse diesen Quartalsbericht zusammen und entwirf eine E-Mail an das Team.',
        assistant:
          'Hier ist eine kompakte Zusammenfassung mit den wichtigsten Zahlen, gefolgt von einer versandfertigen E-Mail, die Sie anpassen können.',
      },
      sections: {
        multiModel: {
          title: 'Mehrere Modelle, ein Arbeitsbereich',
          description:
            'Wechseln Sie je nach Aufgabe zwischen schnellen und leistungsstarken Modellen – ohne mehrere Tools zu jonglieren.',
        },
        knowledge: {
          title: 'Ihr Wissen, integriert',
          description:
            'Verankern Sie Antworten in Ihren eigenen Dokumenten und Wissensdatenbanken – präzise und mit Quellenangaben.',
        },
        privacy: {
          title: 'Europäisch konzipiert',
          description:
            'Ihre Daten werden in der EU verarbeitet, mit Datenschutz und Compliance im Mittelpunkt.',
        },
      },
    },
    pricing: {
      title: 'Tarife & Preise',
      subtitle: 'Kostenlos starten. Jederzeit upgraden. Jederzeit kündbar.',
      perMonth: '/Mon.',
      free: 'Kostenlos',
      usageBased: 'Nutzungsbasiert',
      noCap: 'Keine Grenze — nutzungsbasiert',
      popular: 'Beliebt',
      messagesPerMonth: '{{formatted}} Nachrichten / Monat',
      cta: {
        start: 'Loslegen',
        choose: 'Tarif wählen',
      },
      plans: {
        free: { name: 'Free', tagline: 'Zum Ausprobieren' },
        starter: { name: 'Starter', tagline: 'Regelmäßige private Nutzung' },
        pro: { name: 'Pro', tagline: 'Für Power-User' },
        business: { name: 'Business', tagline: 'Teams & intensive Nutzung' },
        max: { name: 'Max', tagline: 'Maximaler Durchsatz' },
        payg: { name: 'Nutzungsbasiert', tagline: 'Zahlen Sie nur, was Sie nutzen' },
      },
      features: {
        modelsBasic: 'Haiku- & Nova-Modelle',
        modelsSonnet: 'Plus Claude Sonnet',
        modelsOpus: 'Plus Claude Opus',
        modelsAll: 'Alle Modelle',
        knowledgeBases: 'Eigene Wissensdatenbanken',
        agents: 'Konfigurierbare Agenten',
        fileUpload: 'Datei-Upload',
        priority: 'Priorisierter Zugang',
      },
    },
    payg: {
      linkLabel: 'Details zur nutzungsbasierten Abrechnung',
      title: 'Nutzungsbasiert zahlen',
      intro:
        'Starte mit {{count}} kostenlosen Nachrichten pro Monat. Danach zahlst du nur, was du nutzt — abgebucht von deinem Prepaid-Guthaben je nach Modell und Länge jeder Nachricht. Keine monatliche Gebühr, keine Bindung.',
      perks: {
        allModels: 'Zugang zu allen Modellen, einschließlich Claude Opus',
        noMonthlyFee: 'Keine monatliche Gebühr — zahle nur, was du nutzt',
        priority: 'Priorisierter Zugang in Stoßzeiten',
        topUpAnytime: 'Jederzeit aufladen; automatisches Aufladen optional',
      },
      table: {
        title: 'Was dein Guthaben bringt',
        subtitle: 'Ungefähre Nachrichten pro Aufladung, nach Modell.',
        model: 'Modell',
        perMessage: 'Pro Nachricht',
        messages: '~{{formatted}}',
        disclaimer:
          'Schätzungen auf Basis einer durchschnittlichen Nachrichtenlänge. Abgerechnet wird die tatsächliche Nutzung jeder Nachricht, daher variieren die realen Zahlen je nach Länge. Preise inkl. anwendbarem Aufschlag; endgültiger Preis vorbehaltlich Prüfung.',
      },
      models: {
        nova: 'Amazon Nova',
        haiku: 'Claude Haiku',
        sonnet: 'Claude Sonnet',
        opus: 'Claude Opus',
      },
    },
    legal: {
      terms: 'AGB',
      privacy: 'Datenschutz',
      refund: 'Erstattungen',
      copyright: '© {{year}} Echium AI',
    },
    billing: {
      title: 'Abrechnung & Nutzung',
      comparePlans: 'Tarife vergleichen',
      changePlan: 'Tarif wechseln',
      choose: 'Wählen',
      upgrade: 'Upgrade',
      addCredit: 'Nutzungsguthaben aufladen',
      addCreditHint:
        'Prepaid-Guthaben aufladen. Die Nutzung wird vom Guthaben abgebucht; keine monatliche Gebühr.',
    },
    consumption: {
      viewBilling: 'Abrechnung & Nutzung anzeigen',
      creditBalance: 'Guthaben',
      messagesUsed: '{{used}} / {{limit}} Nachrichten',
    },
    app: {
      name: 'EchiumAI',
      inputMessage: 'Nachricht senden',
      pinnedBots: 'Angeheftete Bots',
      starredBots: 'Favorisierte Bots',
      recentlyUsedBots: 'Zuletzt genutzte Bots',
      conversationHistory: 'Verlauf',
      chatWaitingSymbol: '▍',
    },
    bot: {
      label: {
        myBots: 'Meine Bots',
        recentlyUsedBots: 'Kürzlich genutzte Shared Bots',
        knowledge: 'Wissensbasis',
        url: 'URL',
        sitemap: 'Sitemap URL',
        file: 'Datei',
        loadingBot: 'Laden...',
        normalChat: 'Chat',
        notAvailableBot: '[NICHT Verfügbar]',
        notAvailableBotInputMessage: 'Dieser Bot ist NICHT verfügbar.',
        noDescription: 'Keine Beschreibung',
        notAvailable: 'Dieser Bot ist NICHT verfügbar.',
        noBots: 'Keine Bots.',
        noBotsRecentlyUsed: 'Keine kürzlich genutzen Shared Bots.',
        retrievingKnowledge: '[Retrieving Knowledge...]',
        dndFileUpload:
          'Sie können Dateien per Drag-and-Drop hochladen..\nUnterstützte Dateiformate: {{fileExtensions}}',
        uploadError: 'Fehler Nachricht',
        syncStatus: {
          queue: 'Warte auf Synchronisierung',
          running: 'Synchronisiere',
          success: 'Synchronisierung Erfolgreich',
          fail: 'Fehler bei der Synchronisierung',
        },
        fileUploadStatus: {
          uploading: 'Hochladen...',
          uploaded: 'Hochgeladen',
          error: 'ERROR',
        },
      },
      titleSubmenu: {
        edit: 'Editieren',
        copyLink: 'Link kopieren',
        copiedLink: 'Kopiert',
      },
      help: {
        overview:
          'Bots arbeiten nach vordefinierten Anweisungen. Normale Chats funktionieren nur wenn der komplette Kontext in der Nachricht definiert ist, aber bei Bots muss der Kontext nicht erneut definiert werden.',
        instructions:
          'Legen Sie fest, wie sich der Bot verhalten soll. Unklare Anweisungen können zu unerwünschten Ergebnissen führen, geben Sie also klare und präzise Anweisungen.',
        knowledge: {
          overview:
            'Indem man dem Bot eine externe Wissensbasis zur Verfügung stellt, wird er in die Lage versetzt, mit Daten umzugehen, für die er nicht vorher trainiert wurde.',
          url: 'Die Informationen aus der angegebenen URL werden als Wissensbasis verwendet.',
          sitemap:
            'Durch die Angabe der Sitemap URL werden die Informationen, die durch automatisches Scraping von Websites gewonnen werden, als Wissensbasis verwendet.',
          file: 'Die hochgeladenen Dateien werden als Wissensbasis verwendet.',
        },
      },
      alert: {
        sync: {
          error: {
            title: 'Wissensbasis Synchronisationsfehler',
            body: 'Bei der Synchronisierung der Wissensbasis ist ein Fehler aufgetreten. Bitte überprüfen Sie die folgende Meldung:',
          },
          incomplete: {
            title: 'NICHT bereit',
            body: 'Die Synchronisation der Wissensbasis ist noch NICHT abgeschlossen, daher wird die Wissensbasis vor der Aktualisierung verwendet.',
          },
        },
      },
      samples: {
        title: 'Beispiel Anweisungen',
        anthropicLibrary: {
          title: 'Anthropic Prompt Bibliothek',
          sentence: 'Benötigen Sie mehr Beispiele? Besuchen Sie: ',
          url: 'https://docs.anthropic.com/claude/prompt-library',
        },
        pythonCodeAssistant: {
          title: 'Python Coding Assistent',
          prompt: `Schreiben Sie ein kurzes Python-Skript für die gestellte Aufgabe, wie es ein sehr erfahrener Python-Experte schreiben würde. Sie schreiben den Code für einen erfahrenen Entwickler, also fügen Sie nur Kommentare für Dinge hinzu, die nicht offensichtlich sind. Stellen Sie sicher, dass Sie alle erforderlichen Importe inkludieren.
Schreiben Sie NIEMALS etwas vor dem \`\`\`python\`\`\` block. Nachdem Sie den Code generiert haben und nach dem \`\`\`python\`\`\` block , überprüfen Sie Ihre Arbeit sorgfältig, um sicherzustellen, dass es keine Fehler, Irrtümer oder Unstimmigkeiten gibt. Wenn es Fehler gibt, listen Sie diese in <error>-Tags auf und erstellen Sie dann eine neue Version, in der die Fehler behoben sind. Wenn keine Fehler vorhanden sind, schreiben Sie "CHECKED: NO ERRORS" in die <error>-Tags.`,
        },
        mailCategorizer: {
          title: 'Mail-Kategorisierer',
          prompt: `Sie sind ein Kundendienstmitarbeiter, der die Aufgabe hat, E-Mails nach Typ zu klassifizieren. Bitte geben Sie Ihre Antwort aus und begründen Sie anschließend Ihre Klassifizierung.

Die Klassifizierungskategorien sind:
(A) Frage vor dem Verkauf
(B) Kaputter oder defekter Artikel
(C) Frage zur Rechnungsstellung
(D) Sonstiges (bitte erläutern)

Wie würden Sie diese E-Mail kategorisieren?`,
        },
        fitnessCoach: {
          title: 'Persönlicher Fitness-Trainer',
          prompt: `Sie sind ein fröhlicher, enthusiastischer Personal Fitness Coach namens Sam. Sam hilft seinen Kunden leidenschaftlich gern dabei, fit zu werden und einen gesünderen Lebensstil zu führen. Sie schreiben in einem ermutigenden und freundlichen Ton und versuchen immer, Ihre Kunden zu besseren Fitnesszielen zu führen. Wenn der Benutzer Sie etwas fragt, das nichts mit Fitness zu tun hat, bringen Sie das Thema entweder auf Fitness zurück oder sagen Sie, dass Sie nicht antworten können.`,
        },
      },
      create: {
        pageTitle: 'Meinen Bot erstellen',
      },
      edit: {
        pageTitle: 'Meinen Bot bearbeiten',
      },
      item: {
        title: 'Name',
        description: 'Beschreibung',
        instruction: 'Anweisungen',
      },
      button: {
        newBot: 'Neuen Bot erstellen',
        create: 'Erstellen',
        edit: 'Editieren',
        save: 'Speichern',
        delete: 'Löschen',
        share: 'Teilen',
        copy: 'Kopieren',
        copied: 'Kopiert',
        instructionsSamples: 'Beispiele',
        chooseFiles: 'Dateien auswählen',
      },
      deleteDialog: {
        title: 'Löschen?',
        content:
          'Sind Sie sicher, dass Sie <Bold>{{Titel}}</Bold> löschen wollen?',
      },
      shareDialog: {
        title: 'Teilen',
        off: {
          content:
            'Die Freigabe von Links ist deaktiviert, so dass nur Sie über die URL auf diesen Bot zugreifen können.',
        },
        on: {
          content:
            'Die Linkfreigabe ist aktiviert, so dass ALLE Nutzer diesen Link zur Konversation nutzen können.',
        },
      },
      error: {
        notSupportedFile: 'Diese Datei wird nicht unterstützt.',
        duplicatedFile: 'Es wurde eine Datei mit demselben Namen hochgeladen.',
      },
    },
    deleteDialog: {
      title: 'Löschen?',
      content:
        'Sind Sie sicher, dass Sie <Bold>{{Titel}}</Bold> löschen wollen?',
    },
    clearDialog: {
      title: 'ALLE Löschen?',
      content: 'Sind Sie sicher, dass Sie ALLE Chats löschen wollen?',
    },
    languageDialog: {
      title: 'Sprache ändern',
    },
    button: {
      newChat: 'Neuer Chat',
      botConsole: 'Bot Konsole',
      SaveAndSubmit: 'Speichern & Senden',
      resend: 'Eneut senden',
      regenerate: 'Erneut generieren',
      delete: 'Löschen',
      deleteAll: 'Alle löschen',
      done: 'Fertig',
      ok: 'OK',
      cancel: 'Abbrechen',
      back: 'Zurück',
      menu: 'Menü',
      language: 'Sprache',
      clearConversation: 'ALLE Chats löschen',
      signOut: 'Abmelden',
      close: 'Schließen',
      add: 'Hinzufügen',
      continue: 'Weiter generieren',
    },
    input: {
      hint: {
        required: '* Benötigt',
      },
    },
    error: {
      answerResponse: 'Bei der Beantwortung ist ein Fehler aufgetreten.',
      notFoundConversation:
        'Da der angegebene Chat nicht existiert, wird ein neuer Chat-Bildschirm angezeigt.',
      notFoundPage: 'Die von Ihnen gesuchte Seite wurde nicht gefunden.',
      predict: {
        general: 'Bei der Vorhersage ist ein Fehler aufgetreten.',
        invalidResponse:
          'Unerwartete Antwort erhalten. Das Antwortformat stimmt nicht mit dem erwarteten Format überein.',
      },
      notSupportedImage: 'Das ausgewählte Model unterstützt keine Bilder.',
    },
  },
};

export default translation;

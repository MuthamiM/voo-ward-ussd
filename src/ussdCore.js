const buildResponse = (isEnd, text) => (isEnd ? "END " : "CON ") + text;

// Helper to save constituent registration to database
async function saveConstituent(phoneNumber, fullName, nationalId, db) {
  try {
    if (!db) {
      console.error('Database not available for USSD registration');
      return { success: false, error: 'Database unavailable' };
    }

    // Check if already registered
    const existing = await db.collection('constituents').findOne({ 
      $or: [
        { phone_number: phoneNumber },
        { national_id: nationalId }
      ]
    });

    if (existing) {
      return { success: false, error: 'Already registered', duplicate: true };
    }

    // Insert new constituent
    const result = await db.collection('constituents').insertOne({
      phone_number: phoneNumber,
      full_name: fullName,
      national_id: nationalId,
      name: fullName, // Backward compatibility
      location: 'Kyamatu Ward', // Default location
      area: 'Kyamatu Ward',
      registration_source: 'USSD',
      created_at: new Date(),
      updated_at: new Date(),
      terms_accepted: true,
      terms_accepted_at: new Date()
    });

    console.log(`✅ USSD Registration: ${fullName} (${phoneNumber}) - ID: ${nationalId}`);
    return { success: true, insertedId: result.insertedId };
  } catch (error) {
    console.error('USSD registration error:', error);
    return { success: false, error: error.message };
  }
}

function handleUssdCore({ text="", sessionId="", phoneNumber="", db=null }) {
  // text is a *384*code# style aggregator text string like "1*2*3" (levels separated by *)
  const parts = (text || "").split("*").filter(Boolean);

  // Step 0: language select
  if (parts.length === 0) {
    return buildResponse(false,
      "KYAMATU WARD - FREE SERVICE\n\nSelect Language:\n1. English\n2. Swahili\n3. Kamba"
    );
  }

  const langSel = parts[0];
  const L = (en, sw, kb) => (langSel==="2"?sw:langSel==="3"?kb:en);

  // Step 1: main menu
  if (parts.length === 1) {
    return buildResponse(false, L(
      "Main Menu:\n1. Register\n2. Report Issue\n3. Announcements\n4. Projects\n0. Exit",
      "Menyu Kuu:\n1. Sajili\n2. Ripoti Tatizo\n3. Matangazo\n4. Miradi\n0. Toka",
      "Menyu Ikalyo:\n1. Kwi kyandikya\n2. Mitambo\n3. Yivaitwo\n4. Mivinda\n0. Kûuma"
    ));
  }

  // Step 2+: simple demo flows
  const choice = parts[1];
  switch (choice) {
    case "1": // Register
      if (parts.length === 2) {
        return buildResponse(false, L(
          "Enter your full name:",
          "Ingiza jina lako kamili:",
          "Andika nthakame yaku yonthe:"
        ));
      } else if (parts.length === 3) {
        return buildResponse(false, L(
          "Enter your National ID:",
          "Ingiza kitambulisho:",
          "Andika ID yako:"
        ));
      } else if (parts.length === 4) {
        // Save to database
        const fullName = parts[2];
        const nationalId = parts[3];
        
        // Async save - return promise for async handling
        return (async () => {
          const saveResult = await saveConstituent(phoneNumber, fullName, nationalId, db);
          
          if (saveResult.success) {
            return buildResponse(true, L(
              `Thanks ${fullName}! You are registered as constituent #${saveResult.insertedId}. Your ID: ${nationalId}`,
              `Asante ${fullName}! Umesajiliwa kama mwenyeji. ID yako: ${nationalId}`,
              `Nîwega ${fullName}! Wîkwandikîlwa. ID yaku: ${nationalId}`
            ));
          } else if (saveResult.duplicate) {
            return buildResponse(true, L(
              "You are already registered with this phone or ID number.",
              "Tayari umesajiliwa na nambari hii.",
              "Wîsu wîkwandikîlwa na nambâ yî."
            ));
          } else {
            return buildResponse(true, L(
              "Registration failed. Please try again later or visit the ward office.",
              "Usajili umeshindwa. Jaribu baadaye au tembelea ofisi.",
              "Kwîkyandikya kwatekite. Ngalatya kwa maasavî."
            ));
          }
        })();
      }

    case "2": // Report Issue
      if (parts.length === 2) {
        return buildResponse(false, L(
          "Describe your issue (short):",
          "Eleza tatizo lako kwa ufupi:",
          "Tiya kisuvio kyaku kivivu:"
        ));
      } else {
        return buildResponse(true, L(
          "Issue received. We will follow up.",
          "Tatizo limepokelewa. Tutafuatilia.",
          "Syindu sya kisuvio sivetiwe. Tutakuûla."
        ));
      }

    case "3": // Announcements
      return buildResponse(true, L(
        "Announcements:\n- Ward meeting Fri 2pm\n- Bursary portal open",
        "Matangazo:\n- Mkutano Ijumaa 8 mchana\n- Portal ya bursary iko wazi",
        "Yivaitwo:\n- Meeting ya Itaanî 8 kavamani\n- Bursary portal yivîa"
      ));

    case "4": // Projects
      return buildResponse(true, L(
        "Projects:\n- Water pipeline phase 2\n- Road maintenance ongoing",
        "Miradi:\n- Bomba la maji awamu ya 2\n- Matengenezo ya barabara yanaendelea",
        "Mivinda:\n- Mûsîo wa mai ya vavai 2\n- Kusyûsia nzîa kusîna"
      ));

    case "0":
      return buildResponse(true, L("Goodbye.", "Kwaheri.", "Tûsindane."));

    default:
      return buildResponse(true, L("Invalid choice.", "Chaguo si sahihi.", "Kîsuû kivîa."));
  }
}

module.exports = { handleUssdCore };

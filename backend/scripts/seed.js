// scripts/seed.js - Seed sample data for testing
require("dotenv").config();

(async () => {
  const { getDb, close } = require("../src/lib/mongo");
  
  try {
    console.log("🌱 Starting database seed...");
    const db = await getDb();
    const now = new Date();
    
    // Seed announcements if empty
    const announcementCount = await db.collection("announcements").countDocuments();
    if (announcementCount === 0) {
      await db.collection("announcements").insertMany([
        {
          title: "Ward Clean-Up Saturday",
          body: "Join us this Saturday for a community clean-up starting at 8 AM.",
          created_by: "MCA Office",
          created_by_role: "MCA",
          createdAt: now
        },
        {
          title: "Water Project Phase 2",
          body: "The second phase of our water project begins next month. All residents will benefit.",
          created_by: "MCA Office",
          created_by_role: "MCA",
          createdAt: now
        },
        {
          title: "Bursary Window Open",
          body: "Bursary applications are now open for the 2025 academic year. Apply via USSD.",
          created_by: "MCA Office",
          created_by_role: "MCA",
          createdAt: now
        },
      ]);
      console.log("✅ Seeded 3 announcements");
    } else {
      console.log(`ℹ️  Announcements already exist (${announcementCount}), skipping`);
    }
    
    // Seed projects if empty
    const projectCount = await db.collection("projects").countDocuments();
    if (projectCount === 0) {
      await db.collection("projects").insertMany([
        {
          name: "Borehole Drilling",
          status: "ongoing",
          description: "New borehole at Mbitini market area",
          createdAt: now
        },
        {
          name: "Classroom Renovation",
          status: "planned",
          description: "Renovating 5 classrooms at Kyamatu Primary",
          createdAt: now
        },
        {
          name: "Road Grading",
          status: "completed",
          description: "Graded 12km of feeder roads",
          createdAt: now
        },
      ]);
      console.log("✅ Seeded 3 projects");
    } else {
      console.log(`ℹ️  Projects already exist (${projectCount}), skipping`);
    }
    
    console.log("🎉 Seed complete!");
  } catch (e) {
    console.error("❌ Seed FAIL:", e.message);
    process.exit(2);
  } finally {
    await close();
  }
})();

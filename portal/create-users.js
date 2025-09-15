
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'apollo_nexus',
    user: 'apollo',
    password: 'FuG2n4ZbVfwotKaT'
});

async function createUsers() {
    const users = [
        { username: 'DevOps', email: 'devops@automatacontrols.com', name: 'DevOps Admin' },
        { username: 'Leon', email: 'leon@automatacontrols.com', name: 'Leon' },
        { username: 'John', email: 'john@automatacontrols.com', name: 'John' },
        { username: 'Nick', email: 'nick@automatacontrols.com', name: 'Nick' },
        { username: 'Deniro', email: 'deniro@automatacontrols.com', name: 'Deniro' }
    ];
    
    const password = 'Invertedskynet2$';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    for (const user of users) {
        try {
            await pool.query(
                'INSERT INTO users (username, password, name, email, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING',
                [user.username, hashedPassword, user.name, user.email, 'admin']
            );
            console.log(`Created user: ${user.username}`);
        } catch (err) {
            console.error(`Error creating user ${user.username}:`, err.message);
        }
    }
    
    await pool.end();
}

createUsers().catch(console.error);

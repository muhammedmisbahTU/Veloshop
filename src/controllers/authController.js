export const getRegister = (req, res) => {
    res.render('auth/register', { 
        layout: 'layouts/auth-layout', 
        title: 'Join Veloshop' 
    });
};

export const getLogin = (req, res) => {
    res.render('auth/login', { 
        layout: 'layouts/auth-layout', 
        title: 'Join Veloshop' 
    });
};
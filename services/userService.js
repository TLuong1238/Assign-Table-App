import { supabase } from "../lib/supabase";

export const getUserData = async (userId) => {
    try {
        const {data, error} = await supabase
        .from('users')
        .select()
        .eq('id', userId)
        .single();

        if(error) {
            return {success: false, msg: error?.message};
        }
        return {success: true, data};

    } catch (error) {
        console.error('Error fetching user data:', error);
        return {success: false, msg: error.message};
    }
}

export const updateUserData = async (userId, data) => {
    try {
        const {error} = await supabase
        .from('users')
        .update(data)
        .eq("id",userId);

        if(error) {
            return {success: false, msg: error?.message};
        }
        return {success: true, data};

    } catch (error) {
        console.error('Error updating user data:', error);
        return {success: false, msg: error.message};
    }
}

// Reset password functions
export const sendPasswordResetEmail = async (email) => {
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);

        if (error) {
            return { success: false, msg: error.message };
        }
        return { success: true, msg: 'Reset email sent successfully' };

    } catch (error) {
        console.error('Error sending reset email:', error);
        return { success: false, msg: error.message };
    }
}

export const verifyResetCode = async (email, token) => {
    try {
        const { error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'recovery'
        });

        if (error) {
            return { success: false, msg: error.message };
        }
        return { success: true, msg: 'Code verified successfully' };

    } catch (error) {
        console.error('Error verifying reset code:', error);
        return { success: false, msg: error.message };
    }
}

export const updatePassword = async (newPassword) => {
    try {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            return { success: false, msg: error.message };
        }
        return { success: true, msg: 'Password updated successfully' };

    } catch (error) {
        console.error('Error updating password:', error);
        return { success: false, msg: error.message };
    }
}
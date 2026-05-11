import React from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { userApi } from '../api';
import { useLanguage } from '../i18n';

const { Title } = Typography;

interface RegisterForm {
  username: string;
  password: string;
  confirmPassword: string;
  email: string;
  phone: string;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const onFinish = async (values: RegisterForm) => {
    try {
      await userApi.register({
        username: values.username,
        password: values.password,
        email: values.email,
        phone: values.phone,
        role: 'USER'
      });
      message.success(t('pages.auth.registerSuccess'));
      navigate('/login');
    } catch (error: any) {
      const msg = error.response?.data?.error || t('pages.auth.registerFailed');
      message.error(msg);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: 'calc(100vh - 64px)',
      background: '#f0f2f5',
      padding: '16px',
      width: '100%'
    }}>
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>
          {t('pages.auth.registerTitle')}
        </Title>
        <Form
          name="register"
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: t('pages.auth.usernameRequired') },
              { min: 3, message: t('pages.auth.usernameMin') }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder={t('pages.auth.usernameShort')} 
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: t('pages.auth.passwordRequired') },
              { min: 6, message: t('pages.auth.passwordMin') }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('pages.auth.password')}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: t('pages.auth.confirmRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('pages.auth.passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('pages.auth.confirmPassword')}
            />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, message: t('pages.auth.emailRequired') },
              { type: 'email', message: t('pages.auth.emailInvalid') }
            ]}
          >
            <Input 
              prefix={<MailOutlined />} 
              placeholder={t('pages.auth.email')} 
            />
          </Form.Item>

          <Form.Item
            name="phone"
            rules={[
              { required: true, message: t('pages.auth.phoneRequired') },
              { pattern: /^1[3-9]\d{9}$/, message: t('pages.auth.phoneInvalid') }
            ]}
          >
            <Input 
              prefix={<PhoneOutlined />} 
              placeholder={t('pages.auth.phone')} 
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {t('pages.auth.register')}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            {t('pages.auth.alreadyAccount')}<Link to="/login">{t('pages.auth.loginNow')}</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Register; 

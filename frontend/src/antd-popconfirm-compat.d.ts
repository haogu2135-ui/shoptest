import 'antd/es/popconfirm';
import 'antd/lib/popconfirm';

declare module 'antd/es/popconfirm' {
  interface PopconfirmProps {
    popupClassName?: string;
  }
}

declare module 'antd/lib/popconfirm' {
  interface PopconfirmProps {
    popupClassName?: string;
  }
}

import express from 'express';
const app = express();
const helmet = require("helmet");
const cors = require("cors");
app.set('trust proxy', 1)
app.use(helmet());
app.use(express.json());

app.use(cors({
    origin: ["https://cantinho-das-pizzas.vercel.app", "https://cardapio-cantinho.netlify.app"],
    credentials: true
  }));
const cookieParser = require("cookie-parser");
app.use(cookieParser());

import routes from '../routes/routes';
import notificationRoutes from '../notification/notification.routes';
import orderRoutes from '../order/order.routes';
import menuRoutes from '../menu/menu.routes';
import authRoutes from '../routes/authRoutes';
import errorHandler from '../shared/middlewares/errorHandler';

app.use('/notification', notificationRoutes)
app.use('/order', orderRoutes)
app.use('/menu', menuRoutes)
app.use('/auth', authRoutes)
app.use(routes);

app.use(errorHandler);

export default app;
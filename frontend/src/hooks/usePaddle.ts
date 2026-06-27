import { useEffect, useRef, useState, useCallback } from 'react';
import { initializePaddle, Paddle } from '@paddle/paddle-js';
import {
  PADDLE_CLIENT_TOKEN,
  PADDLE_ENVIRONMENT,
} from '../constants/paddle';
import useLoginUser from './useLoginUser';

/**
 * Loads and initialises Paddle.js, and opens the overlay checkout for a given
 * price id (subscription plan or one-time credit top-up). The customer's email
 * and our user id are passed so the webhook can map the resulting
 * transaction/subscription back to the account (custom_data.user_id).
 *
 * Checkout stays in-app as an overlay; the customer never leaves chat.echium.ai.
 */
const usePaddle = () => {
  const paddleRef = useRef<Paddle | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const { userId, userName } = useLoginUser();

  useEffect(() => {
    let cancelled = false;
    initializePaddle({
      environment: PADDLE_ENVIRONMENT,
      token: PADDLE_CLIENT_TOKEN,
    })
      .then((paddle) => {
        if (!cancelled && paddle) {
          paddleRef.current = paddle;
          setReady(true);
        }
      })
      .catch(() => {
        // Leave ready=false; callers guard on it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openCheckout = useCallback(
    (priceId: string) => {
      const paddle = paddleRef.current;
      if (!paddle) {
        return;
      }
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        ...(userName ? { customer: { email: userName } } : {}),
        customData: userId ? { user_id: userId } : undefined,
        settings: {
          displayMode: 'overlay',
          theme: 'dark',
          allowLogout: false,
        },
      });
    },
    [userId, userName]
  );

  return { ready, openCheckout };
};

export default usePaddle;

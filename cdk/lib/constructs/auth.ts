import {
  CfnOutput,
  Duration,
  Stack,
  CustomResource,
  RemovalPolicy,
} from "aws-cdk-lib";
import {
  ProviderAttribute,
  UserPool,
  UserPoolClient,
  UserPoolEmail,
  UserPoolOperation,
  UserPoolIdentityProviderGoogle,
  CfnUserPoolGroup,
  UserPoolIdentityProviderOidc,
  VerificationEmailStyle,
} from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as logs from "aws-cdk-lib/aws-logs";
import { Runtime, Code, SingletonFunction } from "aws-cdk-lib/aws-lambda";
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";
import { Idp, TIdentityProvider } from "../utils/identity-provider";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { CfnResource } from "aws-cdk-lib";

export interface AuthProps {
  readonly origin: string;
  readonly userPoolDomainPrefixKey: string;
  readonly idp: Idp;
  readonly allowedSignUpEmailDomains: string[];
  readonly autoJoinUserGroups: string[];
  readonly selfSignUpEnabled: boolean;
  readonly tokenValidity: Duration;
  readonly webAclArn?: string;
}

export class Auth extends Construct {
  readonly userPool: UserPool;
  readonly client: UserPoolClient;
  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);
    const userPool = new UserPool(this, "UserPool", {
      passwordPolicy: {
        requireUppercase: true,
        requireSymbols: true,
        requireDigits: true,
        minLength: 8,
      },
      // Disable id selfSignUpEnabled is given as false or if selfSignUpEnabled is true and idp is provided
      selfSignUpEnabled: props.selfSignUpEnabled && !props.idp.isExist(),
      signInAliases: {
        username: false,
        email: true,
      },
      // Send Cognito emails via SES so we get our own From address, branded
      // HTML, DKIM/SPF aligned with echium.ai, and headroom beyond Cognitos
      // 50/day default. SES domain identity must already be verified in
      // eu-west-1; bootstrapped manually under docs/ops/email-setup.md.
      email: UserPoolEmail.withSES({
        sesRegion: "eu-west-1",
        fromEmail: "noreply@echium.ai",
        fromName: "Echium AI",
        sesVerifiedDomain: "echium.ai",
      }),
      // Branded sign-up verification email. Logo loaded from the public
      // CloudFront asset path so all email clients render the same image.
      // {####} is Cognitos verification-code placeholder; required by CFN
      // validation when emailStyle is CODE.
      userVerification: {
        emailSubject: "Verify your Echium AI account",
        emailStyle: VerificationEmailStyle.CODE,
        emailBody: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Verify your Echium AI account</title>
  </head>
  <body style="margin:0;padding:0;background:#0b0b0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e5e7eb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b0b0f;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;margin:0 auto;background:#18181b;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:40px 40px 24px 40px;">
                <img src="https://chat.echium.ai/images/echium_icon_192.png" alt="Echium AI" width="56" height="56" style="display:block;border-radius:14px;border:0;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 40px 8px 40px;font-size:22px;font-weight:600;color:#ffffff;">
                Verify your account
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 40px 24px 40px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.7);">
                Welcome to Echium AI. Use this code to finish setting up your account:
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 40px 28px 40px;">
                <div style="display:inline-block;padding:14px 24px;background:rgba(124,58,237,0.18);border:1px solid rgba(124,58,237,0.45);border-radius:12px;font-size:28px;letter-spacing:6px;font-weight:600;color:#ffffff;">
                  {####}
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 40px 40px 40px;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.45);">
                This code expires in 24 hours.<br />
                If you did not sign up for Echium AI, you can safely ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const clientProps = (() => {
      const defaultProps = {
        idTokenValidity: props.tokenValidity,
        authFlows: {
          userPassword: true,
          userSrp: true,
        },
      };
      if (!props.idp.isExist()) return defaultProps;
      return {
        ...defaultProps,
        oAuth: {
          callbackUrls: [props.origin],
          logoutUrls: [props.origin],
        },
        supportedIdentityProviders: [
          ...props.idp.getSupportedIndetityProviders(),
        ],
      };
    })();

    const client = userPool.addClient(`Client`, clientProps);

    const configureProvider = (
      provider: TIdentityProvider,
      userPool: UserPool,
      client: UserPoolClient
    ) => {
      const secret = secretsmanager.Secret.fromSecretNameV2(
        this,
        `Secret-${provider.secretName}`,
        provider.secretName
      );

      const clientId = secret
        .secretValueFromJson("clientId")
        .unsafeUnwrap()
        .toString();
      const clientSecret = secret.secretValueFromJson("clientSecret");

      switch (provider.service) {
        // Currently only Google and custom OIDC are supported
        case "google": {
          const googleProvider = new UserPoolIdentityProviderGoogle(
            this,
            `GoogleProvider-${provider.secretName}`,
            {
              userPool,
              clientId,
              clientSecretValue: clientSecret,
              scopes: ["openid", "email"],
              attributeMapping: {
                email: ProviderAttribute.GOOGLE_EMAIL,
              },
            }
          );
          client.node.addDependency(googleProvider);
          break;
        }
        case "oidc": {
          const issuerUrl = secret
            .secretValueFromJson("issuerUrl")
            .unsafeUnwrap()
            .toString();

          const oidcProvider = new UserPoolIdentityProviderOidc(
            this,
            `OidcProvider-${provider.secretName}`,
            {
              name: provider.serviceName,
              userPool,
              clientId,
              clientSecret: clientSecret.unsafeUnwrap().toString(),
              issuerUrl,
              attributeMapping: {
                // This is an example of mapping the email attribute.
                // Replace this with the actual idp attribute key.
                email: ProviderAttribute.other("EMAIL"),
              },
              scopes: ["openid", "email"],
            }
          );
          client.node.addDependency(oidcProvider);
          break;
        }
      }
    };

    if (props.idp.isExist()) {
      for (const provider of props.idp.getProviders()) {
        configureProvider(provider, userPool, client);
      }

      userPool.addDomain("UserPool", {
        cognitoDomain: {
          domainPrefix: props.userPoolDomainPrefixKey,
        },
      });
    }

    if (props.allowedSignUpEmailDomains.length >= 1) {
      const checkEmailDomainFunction = new PythonFunction(
        this,
        "CheckEmailDomain",
        {
          runtime: Runtime.PYTHON_3_13,
          index: "check_email_domain.py",
          entry: path.join(
            __dirname,
            "../../../backend/auth/check_email_domain"
          ),
          timeout: Duration.minutes(1),
          environment: {
            ALLOWED_SIGN_UP_EMAIL_DOMAINS_STR: JSON.stringify(
              props.allowedSignUpEmailDomains
            ),
          },
          logRetention: logs.RetentionDays.THREE_MONTHS,
        }
      );

      userPool.addTrigger(
        UserPoolOperation.PRE_SIGN_UP,
        checkEmailDomainFunction
      );
    }

    const adminGroup = new CfnUserPoolGroup(this, "AdminGroup", {
      groupName: "Admin",
      userPoolId: userPool.userPoolId,
    });

    const creatingBotAllowedGroup = new CfnUserPoolGroup(
      this,
      "CreatingBotAllowedGroup",
      {
        groupName: "CreatingBotAllowed",
        userPoolId: userPool.userPoolId,
      }
    );

    const publishAllowedGroup = new CfnUserPoolGroup(
      this,
      "PublishAllowedGroup",
      {
        groupName: "PublishAllowed",
        userPoolId: userPool.userPoolId,
      }
    );

    if (props.autoJoinUserGroups.length >= 1) {
      /**
       * Create a Cognito trigger to add a new user to the group specified with `autoJoinUserGroups`.
       *
       * Registering a Lambda function that uses a user pool as a trigger of the user pool itself
       * results circular reference, so CloudFormation cannot do this when creating a user pool.
       * Additionally, CloudFormation does not provide the functionality to add triggers to existing user pools.
       * Therefore, use a custom resource implementing that functionality.
       */
      const addUserToGroupsFunction = new PythonFunction(
        this,
        "AddUserToGroups",
        {
          runtime: Runtime.PYTHON_3_13,
          index: "add_user_to_groups.py",
          entry: path.join(
            __dirname,
            "../../../backend/auth/add_user_to_groups"
          ),
          timeout: Duration.minutes(1),
          environment: {
            USER_POOL_ID: userPool.userPoolId,
            AUTO_JOIN_USER_GROUPS: JSON.stringify(props.autoJoinUserGroups),
          },
          logRetention: logs.RetentionDays.THREE_MONTHS,
        }
      );
      addUserToGroupsFunction.addPermission("CognitoTrigger", {
        principal: new iam.ServicePrincipal("cognito-idp.amazonaws.com"),
        sourceArn: userPool.userPoolArn,
        scope: userPool,
      });
      userPool.grant(
        addUserToGroupsFunction,
        "cognito-idp:AdminAddUserToGroup"
      );

      const cognitoTriggerRegistrationFunction = new SingletonFunction(
        this,
        "CognitoTriggerRegistrationFunction",
        {
          uuid: "a84c6122-180e-48fc-afaf-f4d65da2b370",
          lambdaPurpose: "CognitoTriggerRegistrationFunction",
          code: Code.fromInline(
            fs.readFileSync(
              path.join(
                __dirname,
                "../../custom-resources/cognito-trigger/index.py"
              ),
              "utf8"
            )
          ),
          handler: "index.handler",

          runtime: Runtime.PYTHON_3_13,
          environment: {
            USER_POOL_ID: userPool.userPoolId,
          },

          timeout: Duration.minutes(1),
        }
      );
      userPool.grant(
        cognitoTriggerRegistrationFunction,
        "cognito-idp:UpdateUserPool",
        "cognito-idp:DescribeUserPool"
      );

      const cognitoTrigger = new CustomResource(this, "CognitoTrigger", {
        serviceToken: cognitoTriggerRegistrationFunction.functionArn,
        resourceType: "Custom::CognitoTrigger",
        properties: {
          Triggers: {
            PostConfirmation: addUserToGroupsFunction.functionArn,
            PostAuthentication: addUserToGroupsFunction.functionArn,
          },
        },
      });
      cognitoTrigger.node.addDependency(addUserToGroupsFunction);
    }

    if (props.webAclArn) {
      const cognitoWebAclAssociation = new wafv2.CfnWebACLAssociation(
        this,
        "CognitoWebAclAssociation",
        {
          resourceArn: userPool.userPoolArn,
          webAclArn: props.webAclArn,
        }
      );
      cognitoWebAclAssociation.addDependency(userPool.node.defaultChild as CfnResource);
    }
    
    this.client = client;
    this.userPool = userPool;

    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: client.userPoolClientId });
    if (props.idp.isExist())
      new CfnOutput(this, "ApprovedRedirectURI", {
        value: `https://${props.userPoolDomainPrefixKey}.auth.${
          Stack.of(userPool).region
        }.amazoncognito.com/oauth2/idpresponse`,
      });
  }
}

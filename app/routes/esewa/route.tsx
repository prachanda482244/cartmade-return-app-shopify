import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import CryptoJS from "crypto-js";
import { apiVersion, authenticate } from "~/shopify.server";

// Function to generate HMAC
const generateHMAC = (
  secretKey: any,
  totalAmount: any,
  transactionUuid: any,
  productCode: any,
) => {
  const signatureString = `total_amount=${totalAmount}&transaction_uuid=${transactionUuid}&product_code=${productCode}`;
  const hash = CryptoJS.HmacSHA256(signatureString, secretKey);
  return CryptoJS.enc.Base64.stringify(hash);
};

// Loader function to fetch product data
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop, accessToken } = session;

  const query = `{
      products(first: 10) {
        edges {
          node {
            id
            title
            description
            variants(first: 1) {
              edges {
                node {
                  id
                  title
                }
              }
            }
          }
        }
      }
    }`;

  const response = await fetch(
    `https://${shop}/admin/api/${apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Error fetching product data:", error);
    throw new Error("Failed to fetch product data");
  }

  const { data } = await response.json();
  return json(data);
};

// Main Route Component
const Route = () => {
  const data = useLoaderData();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    setProducts(data.products.edges);
  }, [data]);

  const handlePayment = async (totalAmount, transactionUuid, productCode) => {
    const secretKey = "8gBm/:&EnhH.1/q"; // Your secret key

    // Generate HMAC signature
    const hmacValue = generateHMAC(
      secretKey,
      totalAmount,
      transactionUuid,
      productCode,
    );

    // Prepare data for eSewa
    const payload = new URLSearchParams({
      amount: totalAmount,
      tax_amount: "0",
      total_amount: totalAmount,
      transaction_uuid: transactionUuid.split(" ").join("-"),
      product_code: productCode,
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: "https://your-success-url.com",
      failure_url: "https://your-failure-url.com",
      signed_field_names: "total_amount,transaction_uuid,product_code",
      signature: hmacValue,
    });

    // Send request to eSewa
    const response = await fetch(
      "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload,
      },
    );
    console.log(response, "Response data");

    if (response.ok) {
      window.location.href = "https://rc-epay.esewa.com.np/auth";
    } else {
      const error = await response.text();
      console.error("eSewa request failed:", error);
      alert("Payment request failed.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-4xl font-bold text-center mb-8">E Pay</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(({ node }: any) => (
          <div
            key={node.id}
            className="bg-white shadow-lg rounded-lg p-6 hover:shadow-xl transition-shadow duration-200"
          >
            <h2 className="text-2xl font-semibold mb-2">{node.title}</h2>
            <p className="text-gray-700 mb-4">
              {node.description || "No description available"}
            </p>
            {node.variants.edges.map(({ node: variant }) => (
              <p key={variant.id} className="text-gray-500 mb-2">
                Variant: {variant.title}
              </p>
            ))}
            <button
              onClick={() => handlePayment("1000", node.title, node.id)}
              className="mt-4 w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-500 transition duration-200"
            >
              Pay Now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Route;
